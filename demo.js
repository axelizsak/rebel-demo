// The online demo has no server: this file answers the app's requests in the browser. It is loaded only by the demo's
// page, which mobile/demo.py writes; the real app (mobile/server.py) does not use it.
// - The rules are the same Python files as in the real app, run in the browser by Pyodide: agents/profiler.py (the
//   coach, the risk level, the check on complex products) and mobile/wallet.py (what is open, what is held).
// - What the server computes from the morning run (reference portfolios, ETF sheets, charts) is read from demo.json,
//   prepared by mobile/demo.py.
// - There is no model and nothing is sent anywhere: a typed answer that is not an amount, and "Ask Lena why", say so.
(() => {
  const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";
  const prepared = fetch("demo.json").then((reply) => reply.json());
  const saved = {};  // customer -> where they stand, what the server reads back from its customer log

  const python = (async () => {
    await new Promise((loaded, failed) => {
      const script = Object.assign(document.createElement("script"), { src: `${PYODIDE}pyodide.js`, onload: loaded, onerror: failed });
      document.head.append(script);
    });
    const py = await loadPyodide({ indexURL: PYODIDE });
    for (const file of (await prepared).python) {
      py.FS.mkdirTree(`/home/pyodide/${file.split("/")[0]}`);
      py.FS.writeFile(`/home/pyodide/${file}`, await (await fetch(`py/${file}`)).text());
    }
    py.runPython(`
import json
from agents import profiler
from mobile import wallet
from mobile.customers import CUSTOMERS

def chat(body):
    body = json.loads(body)
    return json.dumps(profiler.step(CUSTOMERS[body["customer"]], bool(body.get("consent")), body.get("answers"), body.get("reply")))

def call(module, name, args):
    return json.dumps(getattr({"profiler": profiler, "wallet": wallet}[module], name)(*json.loads(args)))
`);
    return { chat: py.globals.get("chat"), call: py.globals.get("call") };
  })();
  python.catch(() => {});  // said when the chat needs it

  const problem = (status, message) => Object.assign(new Error(message), { status });
  const rules = (now) => now.answers.rules || [];
  const run = async (module, name, ...args) => {
    const py = await python.catch(() => null);
    if (!py) throw problem(502, "The demo could not load its rules: check your connection and reload the page.");
    return JSON.parse(py.call(module, name, JSON.stringify(args)));
  };
  const placed = (customer) => {
    if (!saved[customer]) throw problem(404, "this customer has no risk level yet");
    return saved[customer];
  };
  const reference = async (now) => {
    const data = await prepared;
    return data.references[now.strategy][data.rules.filter((rule) => rules(now).includes(rule)).join("+")];
  };
  const lastPrice = async (ticker) => {
    const points = (await prepared).sheets[ticker]?.history || [];
    return points.length ? points[points.length - 1] : null;
  };
  const portfolio = async (now) => {
    const data = await prepared;
    const etfs = Object.fromEntries(data.etfs.map((etf) => [etf.ticker, etf]));
    const last = Object.fromEntries(data.etfs.map((etf) => [etf.ticker, data.sheets[etf.ticker]?.history?.slice(-1)[0]?.value]).filter(([, v]) => v));
    const held = Object.fromEntries(now.orders.map((o) => [o.ticker, data.sheets[o.ticker]?.history || []]));
    const ref = await reference(now);
    const target = await run("wallet", "decorate", ref.lines, now.strategy, now.unlocked, rules(now));
    const out = await run("wallet", "holdings", now.orders, last, etfs, target);
    const lastOrder = now.orders.reduce((latest, o) => (o.time.slice(0, 10) > latest ? o.time.slice(0, 10) : latest), "");
    const fresh = Boolean(now.orders.length && ref.version && ref.version >= lastOrder);
    return { ...out, history: await run("wallet", "mix_history", now.orders, held),
      proposal: { version: ref.version, changes: ref.changes, new: fresh, orders: await run("wallet", "proposal_orders", out.lines, target, fresh) } };
  };

  const routes = {
    "/api/start": async () => (await prepared).start,
    "/api/state": async ({ customer }) => ({ state: saved[customer] || null, known: (await prepared).known[customer] }),
    "/api/chat": async (_, body) => {
      const py = await python.catch(() => null);
      if (!py) throw problem(502, "The demo could not load Lena: check your connection and reload the page.");
      let turn;
      try {
        turn = JSON.parse(py.chat(JSON.stringify(body)));
      } catch {  // a typed reply that only the model can read
        throw problem(502, "Lena cannot read typed answers in this online demo: tap one instead.");
      }
      if (turn.archetype) {
        saved[body.customer] = { archetype: turn.archetype, strategy: turn.strategy, why: turn.why, strategy_why: turn.strategy_why,
          answers: turn.answers, sheet: turn.sheet, flags: turn.flags, orders: [], unlocked: false, lessons: {}, learned_days: [],
          streak: null };
      }
      return turn;
    },
    "/api/reference": async ({ customer }) => {
      const now = placed(customer);
      const ref = await reference(now);
      const amount = Number(now.answers.amount || 0);
      const lines = ref.lines.map((line) => ({ ...line, eur: Math.round(amount * line.weight * 100) / 100 }));
      return { ...ref, amount, lines: await run("wallet", "decorate", lines, now.strategy, now.unlocked, rules(now)),
        history: (await prepared).strategy_history[now.strategy] };
    },
    "/api/etfs": async ({ customer }) => {
      const now = placed(customer);
      return { etfs: await run("wallet", "decorate", (await prepared).etfs, now.strategy, now.unlocked, rules(now)) };
    },
    "/api/etf": async ({ ticker }) => {
      const sheet = (await prepared).sheets[ticker];
      if (!sheet) throw problem(404, "No sheet for this ETF in the online demo.");
      return sheet;
    },
    "/api/why": async () => {
      throw problem(502, "Lena explains each line in the full app. This online demo runs without the AI model.");
    },
    "/api/order": async (_, { customer, orders }) => {
      const now = placed(customer);
      if (!Array.isArray(orders) || !orders.length) throw problem(400, "no order to place");
      const etfs = Object.fromEntries((await prepared).etfs.map((etf) => [etf.ticker, etf]));
      const held = now.orders.length ? Object.fromEntries((await portfolio(now)).lines.map((l) => [l.ticker, l.value])) : {};
      for (const item of orders) {
        const wrong = await run("wallet", "check_order", etfs[item.ticker] || null, item.eur, now.strategy, now.unlocked, rules(now),
          item.side || "BUY", held[item.ticker] || 0);
        if (wrong) throw problem(400, `${item.ticker}: ${wrong}`);
      }
      for (const item of [...orders].sort((a, b) => (a.side === "SELL" ? 0 : 1) - (b.side === "SELL" ? 0 : 1))) {
        const price = await lastPrice(item.ticker);
        const eur = Math.round(Number(item.eur) * 100) / 100;
        now.orders.push({ ticker: item.ticker, side: item.side || "BUY", eur, units: price ? Math.round((eur / price.value) * 1e6) / 1e6 : null,
          price: price ? price.value : null, as_of: price ? price.date : null, time: new Date().toISOString().slice(0, 19) });
      }
      return { state: now, portfolio: await portfolio(now) };
    },
    "/api/portfolio": async ({ customer }) => portfolio(placed(customer)),
    "/api/quiz": async (_, { customer, answers }) => {
      const now = placed(customer);
      if (!(await prepared).start.strategies[now.strategy].complex) throw problem(400, "Complex products are not part of this risk level.");
      const result = await run("profiler", "quiz", answers || {});
      if (result.passed) now.unlocked = true;
      return { ...result, state: now };
    },
    "/api/lesson": async (_, { customer, lesson, answer }) => {
      const now = placed(customer);
      if (!(await prepared).start.lessons[lesson]) throw problem(404, "unknown lesson");
      const result = await run("profiler", "lesson", lesson, answer ?? null);
      now.lessons[lesson] = Boolean(now.lessons[lesson]) || result.right;
      const today = new Date().toISOString().slice(0, 10);
      if (result.right && !now.learned_days.includes(today)) now.learned_days.push(today);
      now.streak = await run("profiler", "streak", now.learned_days, today);
      return { ...result, state: now };
    },
    "/api/reset": async (_, { customer }) => {
      delete saved[customer];
      return { state: null };
    },
  };

  const network = window.fetch.bind(window);
  window.fetch = async (input, options) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    const route = routes[url.pathname];
    if (!route) return network(input, options);
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    try {
      return reply(200, await route(Object.fromEntries(url.searchParams), options && options.body ? JSON.parse(options.body) : {}));
    } catch (error) {
      return reply(error.status || 500, { error: error.message });
    }
  };
})();

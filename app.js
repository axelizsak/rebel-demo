// ReBel customer app: one phone. Welcome, consent, chat with Lena, the result (risk level and style), then the app
// itself in three tabs (Portfolio, Explore, Learn) and the sheet of each ETF.
// The server holds the logic (mobile/server.py, mobile/wallet.py); this file shows it and sends what the customer does.
// ReBel is execution-only: the app informs, the customer places every order.

const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (weight) => `${Math.round(weight * 100)}%`;
const signed = (x, digits = 1) => (Math.abs(x) * 10 ** (digits + 2) < 0.5 ? `${(0).toFixed(digits)}%`
  : `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(digits)}%`);
const tone = (x) => (x > 0.0005 ? "up" : x < -0.0005 ? "down" : "flat");
const $ = (id) => document.getElementById(id);
const sum = (items, value) => items.reduce((total, item) => total + value(item), 0);
const day = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// The sleeves: the colour follows the sleeve, never its rank. An ETF outside the reference takes its family's sleeve.
const COLOR = { core_equity: "--shares", bonds: "--bonds", gold: "--gold", satellites: "--crypto", cash: "--cash" };
const FAMILY_SLEEVE = { broad_equity: "core_equity", bonds: "bonds", gold: "gold", cash: "cash" };
// A state of an ETF sheet, or a tone of the AI reading: an arrow and a tone, so that it never rests on colour alone.
const STATE = { up: ["↗", "good"], supportive: ["↗", "good"], neutral: ["→", "wait"], watch: ["!", "wait"], down: ["↘", "bad"], headwind: ["↘", "bad"] };
const TONE = { good: "↗", wait: "→", bad: "↘" };
const RANGES = [["1M", 30], ["3M", 91], ["1Y", 365], ["Max", 100000]]; // days back; the chart starts at the last point on or before
const RANGE_WORDS = { "1M": "over 1 month", "3M": "over 3 months", "1Y": "over 1 year", Max: "since" };

const svg = (size, body, width = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON = {
  back: svg(20, '<path d="M12.5 4.5 7 10l5.5 5.5"/>'),
  up: svg(20, '<path d="M10 15.5v-11M5 9.5l5-5 5 5"/>', 2.4),
  check: svg(16, '<path d="M4 10.5l4 4 8-9"/>', 2.4),
  cross: svg(16, '<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>', 2.4),
  alert: svg(16, '<path d="M10 3 2.5 16h15L10 3zM10 8.5v3.5M10 14.4v.1"/>'),
  lock: svg(14, '<rect x="4" y="9" width="12" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>'),
  person: svg(16, '<circle cx="10" cy="7" r="3.2"/><path d="M3.5 17a6.5 6.5 0 0 1 13 0"/>'),
  pie: svg(22, '<path d="M10 2.5a7.5 7.5 0 1 0 7.5 7.5H10z"/><path d="M12.5 2.9v4.6h4.6a7.5 7.5 0 0 0-4.6-4.6z"/>', 1.8),
  compass: svg(22, '<circle cx="10" cy="10" r="7.5"/><path d="m12.8 7.2-1.7 4-4 1.7 1.7-4z"/>', 1.8),
  book: svg(22, '<path d="M3.5 4.5c2.5-1 4.7-.8 6.5.6v11c-1.8-1.4-4-1.6-6.5-.6zM16.5 4.5c-2.5-1-4.7-.8-6.5.6v11c1.8-1.4 4-1.6 6.5-.6z"/>', 1.8),
  spark: svg(16, '<path d="M10 2.5l1.8 4.7 4.7 1.8-4.7 1.8L10 15.5l-1.8-4.7L3.5 9l4.7-1.8z"/>', 1.6),
};
const LINE = "M0 150 28 138 52 146 80 118 104 128 132 96 158 110 186 78 212 92 240 58 266 74 296 40 322 56 352 24 390 34";
const HERO_ART = `<svg viewBox="0 0 390 190" preserveAspectRatio="none" fill="none" aria-hidden="true">
  <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop class="top" offset="0"/><stop class="bottom" offset="1"/></linearGradient>
  <filter id="glow" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="7"/></filter></defs>
  <path d="${LINE} V190 H0Z" fill="url(#fade)"/>
  <path class="glow" d="${LINE}" filter="url(#glow)"/>
  <path class="stroke" d="${LINE}"/></svg>`;

const blank = () => ({ consent: true, answers: {}, question: null, picked: [], odds: null, seen: [], sheet: [], flags: [],
  left: null, archetype: null, why: "", strategy: null, strategy_why: [], orders: [], unlocked: false, lessons: {}, streak: null,
  reference: null, etfs: null, portfolio: null, tab: "explore", busy: false });
// lessonBook: every lesson as the server sends it; lessons: this customer's progress, lesson -> answered right.
const state = { customers: [], strategies: {}, archetypes: {}, sleeves: {}, coreEtfs: {}, quiz: [], lessonBook: {}, traded: "",
  questions: 0, accountData: [], coach: "", id: null, known: {}, ...blank() };
let run = 0; // grows when the customer changes, so a late answer for the previous one is dropped
let charts = 0; // gives each chart its own gradient id

/** Builds an element. Text children are set as text, never as HTML: what a model or the customer wrote stays text. */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "icon") el.innerHTML = value; // only ever one of the ICON strings above, or a chart built here
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

async function api(path, body) {
  const response = await fetch(path, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `The request failed (${response.status}).`);
  return data;
}

const me = () => state.customers.find((c) => c.id === state.id);
const strategy = () => state.strategies[state.strategy];
const archetype = () => state.archetypes[state.archetype];
const avatar = (c) => h("span", { class: "avatar" }, c.first_name[0]);
const sleeveOf = (etf) => etf.sleeve || state.coreEtfs[etf.ticker] || FAMILY_SLEEVE[etf.family] || "satellites";

function go(name) {
  closeSheet();
  for (const view of document.querySelectorAll(".view")) view.classList.toggle("is-active", view.id === `view-${name}`);
}

// ---- Bottom sheet and toast -----------------------------------------------------------------------------------
function openSheet(...children) {
  $("sheet").replaceChildren(...children.filter((child) => child != null && child !== false));
  $("sheet").hidden = $("backdrop").hidden = false;
  $("sheet").scrollTop = 0;
}
function closeSheet() {
  $("sheet").hidden = $("backdrop").hidden = true;
}
function toast(text) {
  const el = h("div", { class: "toast pop", role: "status" }, h("span", { icon: ICON.check }), text);
  $("screen").append(el);
  setTimeout(() => el.remove(), 2600);
}

// ---- Small pieces -----------------------------------------------------------------------------------------------
const section = (title, ...children) => h("div", { class: "section" }, h("p", { class: "eyebrow" }, title), ...children);
const ticks = (items, icon = ICON.check) => h("ul", { class: "ticks" }, items.map((text) => h("li", {}, h("span", { icon }), text)));
const delta = (x, digits = 1) => h("span", { class: `delta is-${tone(x)}` }, signed(x, digits));
const note = (text) => h("p", { class: "fine" }, text);
const PAST = "Past performance is not a reliable indicator of future results.";
const NOT_ADVICE = "Information, not a personal recommendation: you decide and place each order.";

function initials(ticker) {
  const words = ticker.replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}
const token = (etf) => h("span", { class: "token" }, initials(etf.ticker), h("i", { style: `background:var(${COLOR[sleeveOf(etf)]})` }));

// ---- Charts -----------------------------------------------------------------------------------------------------
/** A line chart of a price or a portfolio's value, with its change in % over the range picked (1M, 3M, 1Y, Max).
 * Drag or hover to read any day. `money`: an amount to show what it would have become; `price`: show the price. */
function lineChart(points, { money = null, price = false, caption = PAST } = {}) {
  const id = `g${(charts += 1)}`;
  const W = 360, H = 150, PAD = 10;
  const head = h("div", { class: "chart-head" });
  const box = h("div", { class: "chart-box" });
  const tabs = h("div", { class: "ranges", role: "tablist" });
  const axis = h("div", { class: "chart-axis" });
  if (!points || points.length < 2) {
    return h("div", { class: "chart is-empty" }, h("p", { class: "fine" }, "No chart yet: the morning run has not been done."));
  }
  let range = "1Y";
  let shown = [];
  const pick = () => {
    const end = new Date(points[points.length - 1].date);
    const from = new Date(end);
    from.setDate(from.getDate() - RANGES.find((r) => r[0] === range)[1]);
    const first = points.reduce((at, p, i) => (new Date(p.date) <= from ? i : at), 0);
    shown = points.slice(first);
    if (shown.length < 2) shown = points.slice(-2);
  };
  const header = (at) => {
    const first = shown[0].value;
    const point = shown[at ?? shown.length - 1];
    const change = point.value / first - 1;
    const words = at == null ? (range === "Max" ? `since ${day(shown[0].date)}` : RANGE_WORDS[range]) : `${day(shown[0].date)} to ${day(point.date)}`;
    const main = price ? eur2.format(point.value) : signed(change);
    const sub = money ? `${eur.format(money)} would have become ${eur.format(money * (1 + change))}` : null;
    head.replaceChildren(...[
      h("div", { class: "chart-figure" }, h("b", { class: price ? "" : `is-${tone(change)}` }, main),
        price ? delta(change) : null, h("small", {}, words)),
      sub ? h("p", { class: "chart-sub" }, sub) : null].filter(Boolean));
  };
  const draw = () => {
    pick();
    const t0 = new Date(shown[0].date).getTime(), t1 = new Date(shown[shown.length - 1].date).getTime();
    const values = shown.map((p) => p.value);
    let lo = Math.min(...values), hi = Math.max(...values);
    const pad = (hi - lo || hi || 1) * 0.08;
    lo -= pad; hi += pad;
    const x = (p) => ((new Date(p.date).getTime() - t0) / (t1 - t0 || 1)) * W;
    const y = (v) => PAD + (1 - (v - lo) / (hi - lo)) * (H - 2 * PAD);
    const line = shown.map((p, i) => `${i ? "L" : "M"}${x(p).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
    const way = tone(shown[shown.length - 1].value / shown[0].value - 1);
    box.className = `chart-box is-${way}`;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="fill-top"/><stop offset="1" class="fill-bottom"/></linearGradient></defs>
      <line class="base" x1="0" x2="${W}" y1="${y(shown[0].value).toFixed(1)}" y2="${y(shown[0].value).toFixed(1)}"/>
      <path class="area" d="${line} L${W} ${H} L0 ${H}Z" fill="url(#${id})"/>
      <path class="line" d="${line}"/>
      <line class="cursor" x1="0" x2="0" y1="0" y2="${H}" visibility="hidden"/>
      <circle class="dot" r="4.5" cx="${W}" cy="${y(shown[shown.length - 1].value).toFixed(1)}"/></svg>`;
    const svgEl = box.querySelector("svg"), cursor = box.querySelector(".cursor"), dot = box.querySelector(".dot");
    const reset = () => { cursor.setAttribute("visibility", "hidden"); dot.setAttribute("cx", W); dot.setAttribute("cy", y(shown[shown.length - 1].value)); header(); };
    const move = (event) => {
      const rect = svgEl.getBoundingClientRect();
      const t = t0 + ((event.clientX - rect.left) / rect.width) * (t1 - t0);
      let best = 0;
      shown.forEach((p, i) => { if (Math.abs(new Date(p.date).getTime() - t) < Math.abs(new Date(shown[best].date).getTime() - t)) best = i; });
      const px = x(shown[best]);
      cursor.setAttribute("x1", px); cursor.setAttribute("x2", px); cursor.setAttribute("visibility", "visible");
      dot.setAttribute("cx", px); dot.setAttribute("cy", y(shown[best].value));
      header(best);
    };
    svgEl.addEventListener("pointermove", move);
    svgEl.addEventListener("pointerdown", move);
    svgEl.addEventListener("pointerleave", reset);
    axis.replaceChildren(h("span", {}, day(shown[0].date)), h("span", {}, day(shown[shown.length - 1].date)));
    header();
    tabs.replaceChildren(...RANGES.map(([name]) => h("button", { class: name === range ? "range is-on" : "range", type: "button",
      role: "tab", "aria-selected": String(name === range), onclick: () => { range = name; draw(); } }, name)));
  };
  draw();
  return h("div", { class: "chart" }, head, box, axis, tabs, caption ? note(caption) : null);
}

/** A donut of shares (each {name, weight, color}) with the % printed beside each, and a figure in the middle. */
function donut(parts, middle, under, amount = null) {
  const r = 54, c = 2 * Math.PI * r, gap = parts.length > 1 ? 2.5 : 0;
  let offset = 0;
  const rings = parts.map((p) => {
    const length = Math.max(p.weight * c - gap, 0.5);
    const ring = `<circle r="${r}" cx="70" cy="70" fill="none" stroke="var(${p.color})" stroke-width="20"
      stroke-dasharray="${length.toFixed(2)} ${(c - length).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"/>`;
    offset += p.weight * c;
    return ring;
  }).join("");
  const art = h("div", { class: "donut-art", icon: `<svg viewBox="0 0 140 140" aria-hidden="true"><g transform="rotate(-90 70 70)">${rings}</g></svg>` },
    h("div", { class: "donut-mid" }, h("b", {}, middle), under ? h("small", {}, under) : null));
  const legend = h("ul", { class: "donut-legend" }, parts.map((p) => h("li", {}, h("i", { style: `background:var(${p.color})` }),
    h("span", {}, p.name), h("b", {}, pct(p.weight)), amount != null ? h("small", {}, eur.format(amount * p.weight)) : null)));
  return h("div", { class: "donut", role: "img", "aria-label": parts.map((p) => `${p.name} ${pct(p.weight)}`).join(", ") }, art, legend);
}
const sleeveParts = (sleeves) => sleeves.map((s) => ({ name: s.name, weight: s.weight, color: COLOR[s.key] }));

// ---- Welcome ------------------------------------------------------------------------------------------------
function renderWelcome() {
  const c = me();
  const back = Boolean(state.strategy);
  $("view-welcome").replaceChildren(
    h("div", { class: "welcome-top" },
      h("p", { class: "wordmark" }, "ReBel"),
      h("h2", { class: "display welcome-title" },
        ...(back ? ["Welcome back, ", h("em", {}, `${c.first_name}.`)] : ["Investing, ", h("em", {}, "explained.")])),
      h("p", { class: "welcome-sub" }, back
        ? `${strategy().label} risk level · ${state.orders.length ? `${state.orders.length} order${state.orders.length > 1 ? "s" : ""} placed` : "nothing invested yet"}.`
        : `Three minutes with ${state.coach}. Your risk level, its model portfolio, and AI that explains every ETF. You decide.`)),
    h("div", { class: "hero-art", icon: HERO_ART }),
    h("div", { class: "grow" }),
    h("div", { class: "welcome-bottom" },
      h("div", { class: "signed" }, avatar(c),
        h("div", {}, h("b", {}, `${c.first_name}, ${c.age}`), h("small", {}, `Signed in · ${c.city}`))),
      h("button", { class: "btn btn-primary", type: "button", onclick: back ? () => openMain(state.orders.length ? "portfolio" : "explore") : () => go("consent") },
        back ? "Open ReBel" : "Get started")));
}

// ---- Consent ------------------------------------------------------------------------------------------------
function renderConsent() {
  const items = state.accountData.map((label) => h("li", {}, h("span", {}, label), h("b", {}, state.known[label])));
  $("view-consent").replaceChildren(
    h("div", { class: "topbar" }, h("button", { class: "icon-btn", type: "button", "aria-label": "Back", icon: ICON.back, onclick: () => go("welcome") })),
    h("div", { class: "pad scroll" },
      h("h2", { class: "display screen-title" }, "Skip what we already know."),
      h("p", { class: "lead" }, `With your OK, ${state.coach} reads these five things from your Belfius accounts and only asks what is missing.`),
      h("ul", { class: "data-list" }, items),
      h("p", { class: "notice" }, h("span", { icon: ICON.person }),
        `${state.coach} is an AI. A Belfius adviser is one tap away, at any time.`)),
    h("div", { class: "footer" },
      h("button", { class: "btn btn-primary", type: "button", onclick: () => startChat(true) }, "Use my data"),
      h("button", { class: "btn btn-text", type: "button", onclick: () => startChat(false) }, "I'd rather answer myself")));
}

// ---- Chat ---------------------------------------------------------------------------------------------------
function renderChat() {
  $("view-chat").replaceChildren(
    h("div", { class: "chat-head" }, h("div", { class: "orb" }),
      h("div", { class: "grow" }, h("b", {}, state.coach), h("small", {}, "AI · ReBel")),
      h("button", { class: "pill", type: "button", onclick: adviserSheet }, "Adviser")),
    h("div", { class: "progress" }, h("i", { id: "progress" })),
    h("div", { class: "messages", id: "messages", "aria-live": "polite" }),
    h("div", { class: "chips", id: "chips" }),
    h("form", { class: "composer", onsubmit: (event) => { event.preventDefault(); typed($("input").value); } },
      h("input", { id: "input", type: "text", placeholder: "Or type your answer", autocomplete: "off", maxlength: "400", "aria-label": "Your answer" }),
      h("button", { class: "send", id: "send", type: "submit", "aria-label": "Send", icon: ICON.up })));
}

function addToChat(el) {
  $("messages").append(el);
  $("messages").scrollTo({ top: $("messages").scrollHeight, behavior: "smooth" });
}
const addBubble = (role, text) => addToChat(h("div", { class: `bubble ${role} pop` }, text));

function setTyping(on) {
  $("typing")?.remove();
  if (on) addToChat(h("div", { class: "typing pop", id: "typing", "aria-label": `${state.coach} is writing` }, h("i"), h("i"), h("i")));
}

/** The answers to tap for the question asked. The customer's rules take several: tap them, then confirm. */
function showChoices(again = false) {
  const question = state.question;
  // `again`: the same chips drawn again after a tap, so they do not bounce in a second time
  const chip = (label, onclick, look = "") => h("button", { class: `chip${again ? "" : " pop"}${look ? ` ${look}` : ""}`, type: "button",
    onclick, "aria-pressed": look === "is-on" ? "true" : look === "is-off" ? "false" : null }, label);
  let chips = [];
  if (question?.kind === "rules") {
    // Several answers: each tap ticks or unticks one, then the last chip confirms them all at once.
    const toggle = (value) => { state.picked = state.picked.includes(value) ? state.picked.filter((v) => v !== value) : [...state.picked, value]; showChoices(true); };
    const labels = question.choices.filter((c) => state.picked.includes(c.value)).map((c) => c.label);
    chips = [h("p", { class: "chips-hint" }, state.picked.length ? `${state.picked.length} ticked · tap again to untick` : "Tick all that apply, then confirm"),
      ...question.choices.map((c) => chip(state.picked.includes(c.value) ? `✓ ${c.label}` : c.label, () => toggle(c.value),
        state.picked.includes(c.value) ? "is-on" : "is-off")),
      chip(state.picked.length ? `Confirm: never ${labels.join(", ").toLowerCase()}` : "No, nothing", () => answer(state.picked,
        state.picked.length ? labels.join(", ") : "No, nothing"), "is-confirm")];
  } else if (question) {
    chips = question.choices.map((c) => chip(c.label, () => answer(c.value, c.label)));
  }
  $("chips").replaceChildren(...chips);
  $("messages").scrollTop = $("messages").scrollHeight;
}

function startChat(consent) {
  Object.assign(state, blank(), { consent });
  renderChat();
  go("chat");
  turn();
}

const answer = (value, label) => { if (!state.busy) { addBubble("customer", label); turn({ question: state.question.id, value }); } };

function typed(text) {
  text = text.trim();
  if (!text || state.busy || !state.question) return;
  addBubble("customer", text);
  $("input").value = "";
  turn({ question: state.question.id, text });
}

/** Sends the customer's reply, then shows what the coach says, the next question and what the code now holds. */
async function turn(reply) {
  const mine = run;
  state.busy = true;
  $("chips").replaceChildren();
  setTyping(true);
  sync();
  try {
    const next = await api("/api/chat", { customer: state.id, consent: state.consent, answers: state.answers, reply });
    if (mine !== run) return;
    const again = Boolean(reply) && next.question?.id === reply.question;  // not understood: the same question stays
    Object.assign(state, { answers: next.answers, question: next.question, picked: [], odds: next.odds, seen: next.seen,
      sheet: next.sheet, flags: next.flags, left: next.left, archetype: next.archetype, why: next.why,
      strategy: next.strategy, strategy_why: next.strategy_why, orders: [], unlocked: false, lessons: {}, streak: null });
    setTyping(false);
    for (const line of next.said) addBubble("coach", line);
    if (next.question && !again) {
      addBubble("coach", next.question.text);
    } else if (!next.question) {
      addToChat(h("div", { class: "ready pop" }, h("b", {}, "Your result is ready"),
        h("p", {}, "Your risk level, set by fixed rules on your answers, and the kind of investor you are."),
        h("button", { class: "btn btn-primary", type: "button", onclick: () => { renderReveal(); go("reveal"); } }, "Show me")));
    }
  } catch (error) {
    if (mine !== run) return;
    setTyping(false);
    addToChat(h("div", { class: "chat-error pop" }, h("span", {}, error.message)));
  }
  state.busy = false;
  showChoices();
  sync();
}

function adviserSheet() {
  openSheet(h("h3", {}, "Talk to a person"),
    h("p", {}, `A Belfius adviser can take over at any point, with what you already told ${state.coach}, so you never start again.`),
    h("p", {}, "This is a prototype: no call is placed."),
    h("button", { class: "btn btn-ghost", type: "button", onclick: closeSheet }, "Close"));
}

/** ReBel is execution-only. Who wants someone else to decide is sent to Belfius: advice or a managed portfolio. */
function handoffSheet() {
  openSheet(h("h3", {}, "Rather have someone decide?"),
    h("p", {}, "In ReBel you decide and place each order yourself. If you would rather not, Belfius can take over:"),
    h("div", { class: "options" },
      h("div", { class: "option" }, h("b", {}, "Belfius advises, you decide"), h("small", {}, "An adviser proposes, you approve each move. MyPortfolio, funds.")),
      h("div", { class: "option" }, h("b", {}, "Belfius manages it for you"), h("small", {}, "A managed portfolio: Belfius decides within your risk level, for a fee."))),
    h("p", {}, `What you told ${state.coach} goes with you, so you never start again. This is a prototype: nothing is sent.`),
    h("button", { class: "btn btn-ghost", type: "button", onclick: closeSheet }, "Close"));
}
const handoffCard = () => h("button", { class: "handoff", type: "button", onclick: handoffSheet },
  h("span", { class: "handoff-icon", icon: ICON.person }),
  h("span", { class: "grow" }, h("b", {}, "Rather have someone decide for you?"), h("small", {}, "Belfius advice or a managed portfolio")), h("span", { class: "chev" }, "›"));

// ---- Result: risk level and style ----------------------------------------------------------------------------
const levelDots = (level) => h("span", { class: "dots", "aria-label": `level ${level} of 3` }, [1, 2, 3].map((n) => h("i", { class: n <= level ? "is-on" : "" })));
const flagsPanel = () => h("div", { class: "panel is-warn" },
  h("b", {}, "An adviser looks at this with you first"), ticks(state.flags, ICON.alert));

function renderReveal() {
  const s = strategy(), a = archetype();
  $("view-reveal").replaceChildren(
    h("div", { class: "scroll" },
      h("div", { class: `reveal-hero s-${state.strategy}` },
        h("p", { class: "eyebrow" }, "Your risk level"),
        h("h2", { class: "display" }, s.label),
        h("p", {}, s.tagline), h("div", { class: "level" }, levelDots(s.level), h("small", {}, `level ${s.level} of 3`))),
      section("Set by rules on your answers", h("div", { class: "panel" }, ticks(state.strategy_why))),
      state.flags.length ? section("Before you invest", flagsPanel()) : null,
      h("div", { class: `style-card p-${state.archetype}` },
        h("p", { class: "eyebrow" }, "Your investor style"),
        h("b", {}, a.label), h("p", {}, a.tagline),
        h("small", {}, state.why)),
      section(`${state.coach} helps you first with`, h("div", { class: "panel" },
        ticks(a.lessons.map((key) => state.lessonBook[key].title), ICON.spark))),
      h("p", { class: "fine pad-x" }, "Your risk level decides what you are shown and what you can buy. Your style only decides how we help."),
      h("div", { style: "height:14px" })),
    h("div", { class: "footer" },
      h("button", { class: "btn btn-primary", type: "button", onclick: () => openMain("explore") }, `See the ${s.label} model portfolio`),
      h("button", { class: "btn btn-text", type: "button", onclick: startOver }, "Redo the questions")));
}

// ---- The app: three tabs ---------------------------------------------------------------------------------------
async function load() {
  const [reference, etfs, portfolio] = await Promise.all([
    api(`/api/reference?customer=${state.id}`), api(`/api/etfs?customer=${state.id}`), api(`/api/portfolio?customer=${state.id}`)]);
  Object.assign(state, { reference, etfs: etfs.etfs, portfolio });
}

async function openMain(tab) {
  state.tab = tab || state.tab;
  await load();
  renderMain();
  go("main");
  renderWelcome();
}

function renderMain() {
  const tabs = [["portfolio", "Portfolio", ICON.pie], ["explore", "Explore", ICON.compass], ["learn", "Learn", ICON.book]];
  const body = { portfolio: portfolioTab, explore: exploreTab, learn: learnTab }[state.tab]();
  $("view-main").replaceChildren(
    h("div", { class: "scroll", id: "main-scroll" }, body, h("div", { style: "height:90px" })),
    h("nav", { class: "tabbar" }, tabs.map(([key, name, icon]) => h("button", { class: key === state.tab ? "tab is-on" : "tab", type: "button",
      "aria-current": key === state.tab ? "page" : null, onclick: () => { state.tab = key; renderMain(); $("main-scroll").scrollTop = 0; } },
      h("span", { icon }), h("small", {}, name)))));
}

const pageHead = (title, aside) => h("div", { class: "page-head" }, h("h2", { class: "display" }, title), aside || null);
const strategyBadge = () => h("span", { class: `badge s-${state.strategy}` }, `${strategy().label} · level ${strategy().level} of 3`);

// Portfolio: what the customer holds, its value and its mix against the model portfolio of their risk level.
function portfolioTab() {
  const p = state.portfolio;
  if (!p.lines.length) {
    return h("div", {}, pageHead("Portfolio", strategyBadge()),
      h("div", { class: "empty" }, h("div", { class: "empty-art", icon: ICON.pie }),
        h("b", {}, "Nothing invested yet"),
        h("p", {}, `The ${strategy().label} model portfolio is the same for every ${strategy().label} customer: a mix to compare with, not a recommendation for you. You choose what to buy, ETF by ETF.`),
        h("button", { class: "btn btn-primary", type: "button", onclick: () => { state.tab = "explore"; renderMain(); } }, "See the model portfolio")),
      h("div", { class: "section" }, handoffCard()));
  }
  const gain = p.value - p.invested;
  return h("div", {},
    pageHead("Portfolio", strategyBadge()),
    h("div", { class: "balance" }, h("small", {}, "Total value"), h("b", {}, eur2.format(p.value)),
      h("span", { class: "balance-delta" }, delta(p.gain), h("small", {}, `${gain >= 0 ? "+" : "−"}${eur2.format(Math.abs(gain))} since you bought`))),
    proposalCard(p.proposal),
    p.history && p.history.length > 1 ? h("div", { class: "card-flat" }, lineChart(p.history, {
      caption: "What the ETFs you hold today, in today's units, did before. " + PAST })) : null,
    section("Your mix", h("div", { class: "panel" }, donut(sleeveParts(p.sleeves), eur.format(p.value), `${p.lines.length} ETF${p.lines.length > 1 ? "s" : ""}`, p.value))),
    section(`Against the ${strategy().label} model portfolio`, h("div", { class: "panel" },
      h("div", { class: "health" }, p.health.map((row) => h("div", { class: `health-row is-${row.state}` },
        h("span", { class: "k" }, row.name),
        h("span", { class: "bars" }, h("i", { class: "held", style: `width:${Math.min(row.held, 1) * 100}%` }), h("i", { class: "target", style: `left:${Math.min(row.target, 1) * 100}%` })),
        h("span", { class: "v" }, `${pct(row.held)} / ${pct(row.target)}`),
        h("span", { class: "state" }, { ok: "OK", watch: "Watch", gap: "Gap" }[row.state])))),
      p.ideas.length ? h("div", { class: "ideas" }, h("b", {}, "Where you differ from it"), ticks(p.ideas, ICON.spark),
        note("Kinds of assets to look at, never an order. You pick the ETFs, or none.")) : h("p", { class: "fine" }, "You are close to the model portfolio."))),
    section("Holdings", h("div", { class: "lines" }, p.lines.map((line) => h("button", { class: "line", type: "button", onclick: () => openEtf(line.ticker) },
      token(line), h("span", { class: "name" }, h("b", {}, line.ticker), h("small", {}, `${pct(line.weight)} · ${line.theme}`)),
      h("span", { class: "figures" }, h("b", {}, eur2.format(line.value)), delta(line.gain)))))),
    h("div", { class: "section" }, handoffCard()));
}

// Explore: the model portfolio of the customer's risk level (information), then every ETF of the universe.
function exploreTab() {
  const ref = state.reference, s = strategy();
  const open = ref.lines.filter((l) => !l.lock), locked = ref.lines.filter((l) => l.lock);
  const groups = [];
  for (const etf of state.etfs) {
    const group = groups.find((g) => g.theme === etf.theme) || (groups.push({ theme: etf.theme, items: [] }), groups[groups.length - 1]);
    group.items.push(etf);
  }
  return h("div", {},
    pageHead("Explore", strategyBadge()),
    h("div", { class: `ref-card s-${state.strategy}` },
      h("p", { class: "eyebrow" }, "Model portfolio of your risk level"),
      h("b", {}, `${s.label}`), h("p", {}, `Made for ${s.fits}. The same for every ${s.label} customer: information, not a recommendation for you alone.`),
      h("p", { class: "ref-version" }, h("span", { icon: ICON.spark }), ref.version
        ? `Updated ${day(ref.version)} by our agents, within the ${s.label} limits.`
        : `The starting mix. Our agents update it within the ${s.label} limits after each day we review.`)),
    ref.changes && ref.changes.length ? section(`What changed on ${day(ref.version)}`, changesPanel(ref.changes)) : null,
    h("div", { class: "card-flat" }, lineChart(ref.history, { money: ref.amount || 10000,
      caption: `The ${s.label} model portfolio, put back to its weights each month. ${PAST}` })),
    section("Where the money goes", h("div", { class: "panel" }, donut(sleeveParts(ref.sleeves), "100%", `${ref.lines.length} ETFs`, ref.amount || null))),
    ...Object.keys(state.sleeves).map((key) => refSleeve(ref.lines, key)),
    ref.left_out.length ? section("Your rules", h("div", { class: "panel" },
      ticks(ref.left_out.map((out) => `No ${out.rule.toLowerCase()}: ${out.ticker} is left out, its ${pct(out.weight)} goes to ${ref.lines[0].ticker}`)))) : null,
    h("div", { class: "section" },
      h("button", { class: "btn btn-primary", type: "button", onclick: basketSheet, disabled: !open.length }, "Buy this mix myself"),
      note(`${NOT_ADVICE}${locked.length ? ` ${locked.length} locked ETF${locked.length > 1 ? "s are" : " is"} left out.` : ""}`)),
    h("div", { class: "section" }, handoffCard()),
    section("All ETFs", note("The whole ReBel selection: open one to see what our AI reads in it."),
      ...groups.map((g) => h("div", { class: "group" }, h("p", { class: "group-name" }, g.theme),
        h("div", { class: "lines" }, g.items.map(catalogueRow))))));
}

function refSleeve(lines, key) {
  const mine = lines.filter((line) => line.sleeve === key);
  if (!mine.length) return null;
  return h("div", { class: "section" },
    h("div", { class: "sleeve-head" }, h("b", {}, h("i", { class: "swatch", style: `background:var(${COLOR[key]})` }), `${state.sleeves[key]} · ${pct(sum(mine, (l) => l.weight))}`),
      h("small", {}, mine.length > 1 ? `${mine.length} ETFs` : "1 ETF")),
    h("div", { class: "lines" }, mine.map((line) => h("button", { class: line.lock ? "line is-locked" : "line", type: "button", onclick: () => openEtf(line.ticker) },
      token(line), h("span", { class: "name" }, h("b", {}, line.ticker, line.lock ? h("span", { class: "lock", icon: ICON.lock }) : null),
        h("small", {}, line.lock || line.theme)),
      h("span", { class: "figures" }, h("b", {}, pct(line.weight)),
        line.returns["1 year"] != null ? h("small", {}, delta(line.returns["1 year"]), " 1Y") : null)))));
}

function catalogueRow(etf) {
  const year = etf.returns["1 year"];
  return h("button", { class: etf.lock ? "line is-locked" : "line", type: "button", onclick: () => openEtf(etf.ticker) },
    token(etf), h("span", { class: "name" }, h("b", {}, etf.ticker, etf.lock ? h("span", { class: "lock", icon: ICON.lock }) : null),
      h("small", {}, etf.lock || etf.name)),
    h("span", { class: "figures" }, year != null ? delta(year) : h("small", {}, "—"), h("small", {}, "1 year")));
}

// Learn: what the coach helps with first, the check that opens complex products, and the way to a person.
function learnTab() {
  const s = strategy(), a = archetype();
  const firsts = a.lessons.filter((key) => state.lessons[key]).length;
  const others = Object.keys(state.lessonBook).filter((key) => !a.lessons.includes(key));
  const check = !s.complex
    ? h("div", { class: "panel" }, h("b", {}, "Leveraged, inverse and crypto ETFs"),
      h("p", {}, `They are not part of the ${s.label} risk level, so they stay locked. Your risk level follows your answers.`))
    : state.unlocked
      ? h("div", { class: "panel is-good" }, h("b", {}, "Complex products unlocked"),
        h("p", {}, "You passed the check on leveraged, inverse and crypto ETFs. They can fall fast: keep them a small part."))
      : h("div", { class: "panel" }, h("b", {}, "Unlock leveraged, inverse and crypto ETFs"),
        h("p", {}, "Three questions on what can go wrong. Every answer must be right: the check is recorded."),
        h("button", { class: "btn btn-primary", type: "button", onclick: quizSheet }, "Take the 3-question check"));
  return h("div", {},
    pageHead("Learn", h("span", { class: `badge p-${state.archetype}` }, a.label)),
    streakCard(),
    h("div", { class: `style-card p-${state.archetype}` }, h("p", { class: "eyebrow" }, "Your investor style"),
      h("b", {}, a.label), h("p", {}, a.tagline)),
    section(`${state.coach} helps you first with`,
      h("div", { class: "learn-progress" }, h("span", { class: "track" }, h("i", { style: `width:${(firsts / a.lessons.length) * 100}%` })),
        h("small", {}, `${firsts} of ${a.lessons.length} done`)),
      h("div", { class: "lessons" }, a.lessons.map((key, i) => lessonRow(key, i + 1)))),
    section("Good to know", h("div", { class: "panel" }, ticks(a.tips, ICON.spark))),
    section("More to learn", h("div", { class: "lessons" }, others.map((key) => lessonRow(key)))),
    section("Products", check),
    h("div", { class: "section" }, handoffCard()));
}

/** The learning streak: the days in a row with a lesson answered right, and the last seven days. It rewards
 * learning, never trading: no order counts. */
function streakCard() {
  const s = state.streak || { days: 0, today: false, week: [false, false, false, false, false, false, false] };
  const names = ["S", "M", "T", "W", "T", "F", "S"], today = new Date().getDay();
  const hint = s.today ? "Today's lesson is done. Come back tomorrow to keep it going."
    : s.days ? "One lesson today keeps your streak going." : "One lesson a day starts a streak.";
  return h("div", { class: s.days ? "streak is-on" : "streak" },
    h("span", { class: "streak-n" }, h("b", {}, String(s.days)), h("small", {}, s.days === 1 ? "day" : "days")),
    h("span", { class: "grow" }, h("b", {}, "Learning streak"), h("small", {}, hint),
      h("span", { class: "streak-week" }, s.week.map((done, i) => h("i", { class: done ? "is-done" : "",
        title: done ? "lesson done" : "no lesson" }, names[(today - 6 + i + 7) % 7])))));
}

/** One lesson in a list: its number (a tick once answered right), its title, then a minute or "Done". */
function lessonRow(key, n = null) {
  const done = Boolean(state.lessons[key]);
  return h("button", { class: done ? "lesson is-done" : "lesson", type: "button", onclick: () => lessonSheet(key) },
    h("span", { class: "lesson-n", icon: done ? ICON.check : null }, done ? null : n ? String(n) : "·"),
    h("span", { class: "grow" }, state.lessonBook[key].title), h("small", {}, done ? "Done" : "1 min"), h("span", { class: "chev" }, "›"));
}

/** A lesson: a few plain sentences, one question, then why the answer is right or wrong. A wrong answer can be tried again. */
function lessonSheet(key) {
  const lesson = state.lessonBook[key];
  const feedback = h("div", { class: "lesson-feedback", hidden: true });
  const choices = h("div", { class: "quiz-choices" });
  const ask = () => {
    choices.replaceChildren(...lesson.choices.map((c) => {
      const chip = h("button", { class: "choice", type: "button" }, c.label);
      chip.addEventListener("click", async () => {
        for (const other of choices.children) other.disabled = true;
        chip.classList.add("is-on");
        try {
          const out = await api("/api/lesson", { customer: state.id, lesson: key, answer: c.value });
          Object.assign(state, { lessons: out.state.lessons, streak: out.state.streak });
          chip.classList.replace("is-on", out.right ? "is-right" : "is-wrong");
          feedback.className = `lesson-feedback ${out.right ? "is-good" : "is-wait"}`;
          const why = out.why.replace(/^(Right|No): /, "");
          feedback.replaceChildren(...[h("b", {}, out.right ? "Right." : "Not quite."), h("p", {}, why.charAt(0).toUpperCase() + why.slice(1)),
            out.right ? null : h("p", {}, `The right answer: ${out.right_answer}.`),
            out.right ? h("button", { class: "btn btn-primary", type: "button", onclick: () => { closeSheet(); renderMain(); } }, "Done")
              : h("button", { class: "btn btn-ghost", type: "button", onclick: () => { feedback.hidden = true; ask(); } }, "Try again")].filter(Boolean));
          feedback.hidden = false;
          renderMain();
          sync();
        } catch (error) {
          feedback.replaceChildren(h("p", {}, error.message));
          feedback.hidden = false;
        }
      });
      return chip;
    }));
  };
  ask();
  openSheet(h("p", { class: "eyebrow" }, "Lesson · 1 minute"), h("h3", {}, lesson.title),
    h("div", { class: "lesson-text" }, lesson.text.map((line) => h("p", {}, line))),
    h("div", { class: "quiz-q" }, h("b", {}, lesson.question), choices), feedback,
    h("button", { class: "btn btn-text", type: "button", onclick: closeSheet }, "Close"));
}

// ---- ETF sheet ----------------------------------------------------------------------------------------------
const shownValue = (line) => (line.block === "returns" ? signed(line.value) : line.state);
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

/** Opens the sheet of one ETF: its chart, what our AI reads in it, its returns, trends, macro and news. */
async function openEtf(ticker) {
  let sheet = null;
  try { sheet = await api(`/api/etf?ticker=${encodeURIComponent(ticker)}`); } catch (error) { sheet = { missing: error.message }; }
  const etf = (state.etfs || []).find((e) => e.ticker === ticker) || { ticker, lock: "" };
  const line = (state.reference?.lines || []).find((l) => l.ticker === ticker);
  renderEtf(etf, line, sheet);
  go("etf");
  $("etf-scroll").scrollTop = 0;
}

function renderEtf(etf, line, sheet) {
  const detail = h("div", { class: "section", id: "tile-detail" });
  const pick = (item) => {
    const checks = item.detail.split("; ").filter(Boolean);
    const answerEl = h("p", { class: "why", hidden: true });
    const ask = h("button", { class: "btn btn-ghost", type: "button" }, `Ask ${state.coach} why`);
    ask.addEventListener("click", async () => {
      ask.disabled = true;
      ask.textContent = `${state.coach} is reading the sheet...`;
      try { answerEl.textContent = (await api("/api/why", { ticker: etf.ticker, block: item.block, name: item.name })).answer; } catch (error) { answerEl.textContent = error.message; }
      answerEl.hidden = false;
      ask.remove();
    });
    detail.replaceChildren(h("p", { class: "eyebrow" }, `${item.block} · ${item.label}`),
      h("div", { class: "panel" }, h("ul", { class: "ticks" }, (checks.length ? checks : [shownValue(item)]).map((text) =>
        h("li", { class: text.includes(": no") ? "is-no" : "" }, h("span", { icon: text.includes(": no") ? ICON.cross : ICON.check }), text))), answerEl, ask));
    detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const tiles = (block, title) => {
    const items = (sheet.lines || []).filter((l) => l.block === block);
    if (!items.length) return null;
    return section(title, h("div", { class: "sheet-tiles" }, items.map((item) => {
      if (block === "returns") {
        const t = item.name === "volatility" ? "plain" : { up: "good", down: "bad", flat: "plain" }[tone(item.value)];
        return h("div", { class: `sheet-tile is-${t}` }, h("small", {}, item.label),
          h("b", {}, item.name === "volatility" ? pct(item.value) : signed(item.value)));
      }
      const [arrow, look] = STATE[item.state] || ["", "plain"];
      return h("button", { class: `sheet-tile is-${look}`, type: "button", onclick: () => pick(item) },
        h("small", {}, item.label), h("b", {}, `${arrow} ${item.state}`));
    })));
  };
  const news = sheet.news;
  const lean = news ? (news.direction >= 0.15 ? ["Leans positive", "good"] : news.direction <= -0.15 ? ["Leans negative", "bad"] : ["No clear edge", "wait"]) : null;
  const holding = (state.portfolio?.lines || []).find((l) => l.ticker === etf.ticker);
  const sell = holding ? h("button", { class: "btn btn-ghost", type: "button", onclick: () => sellSheet(etf, holding) }, `Sell · you hold ${eur.format(holding.value)}`) : null;
  const buy = etf.lock
    ? h("div", { class: "footer" }, h("div", { class: "locked-note" }, h("span", { icon: ICON.lock }), etf.lock),
      state.strategy && strategy().complex && !state.unlocked && ["crypto", "leveraged_inverse"].includes(etf.family)
        ? h("button", { class: "btn btn-ghost", type: "button", onclick: quizSheet }, "Take the 3-question check") : null, sell)
    : h("div", { class: "footer" }, h("button", { class: "btn btn-primary", type: "button", onclick: () => buySheet(etf, line, sheet) }, `Buy ${etf.ticker}`), sell);
  $("view-etf").replaceChildren(
    h("div", { class: "topbar" },
      h("button", { class: "icon-btn", type: "button", "aria-label": "Back", icon: ICON.back, onclick: () => { renderMain(); go("main"); } }),
      h("b", {}, etf.ticker), h("span", { style: "width:40px" })),
    h("div", { class: "scroll", id: "etf-scroll" },
      h("div", { class: "etf-head" }, token(etf), h("div", {}, h("h2", { class: "etf-name" }, sheet.name || etf.ticker),
        h("small", {}, [sheet.theme, sheet.isin].filter(Boolean).join(" · ")))),
      sheet.missing ? h("p", { class: "note" }, sheet.missing) : null,
      sheet.history ? h("div", { class: "card-flat" }, lineChart(sheet.history, { price: true })) : null,
      line ? h("p", { class: "in-ref" }, `${pct(line.weight)} of the ${strategy().label} model portfolio · ${eur.format(line.eur)} of your ${eur.format(state.reference.amount)}`) : null,
      sheet.reading && sheet.reading.length ? h("div", { class: "section" }, h("div", { class: "ai-card" },
        h("div", { class: "ai-head" }, h("span", { class: "orb small" }), h("b", {}, "What our AI sees today"), h("small", {}, day(sheet.as_of))),
        h("ul", { class: "ai-lines" }, sheet.reading.map((r) => h("li", { class: `is-${r.tone}` },
          h("span", { class: "ai-arrow" }, TONE[r.tone]), h("span", {}, h("b", {}, r.topic), r.text)))),
        h("p", { class: "fine" }, "Written by code from the agents' numbers. Information, not a personal recommendation."))) : null,
      tiles("returns", "Returns"), tiles("trend", "Trend · tap one"), tiles("macro", "Macro today · tap one"), detail,
      news ? section("In the news", h("div", { class: "panel news" },
        h("div", { class: "news-head" }, h("span", { class: `lean is-${lean[1]}` }, `${TONE[lean[1]]} ${lean[0]}`),
          h("small", {}, `${pct(news.confidence)} sure · next few days · ${day(news.date)}`)),
        h("p", {}, news.rationale),
        news.counter ? h("div", { class: "counter" }, h("b", {}, "The other side"), h("p", {}, news.counter)) : null,
        news.sources.length ? h("div", { class: "sources" }, h("small", {}, "Sources"),
          news.sources.map((url) => h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, host(url)))) : null)) : null,
      sheet.as_of ? h("p", { class: "quiet center" }, `From the morning run of ${day(sheet.as_of)}. ${NOT_ADVICE}`) : null,
      h("div", { style: "height:14px" })),
    buy);
}

// ---- Orders: the customer's own -------------------------------------------------------------------------------
function buySheet(etf, line, sheet) {
  const last = sheet.history && sheet.history.length ? sheet.history[sheet.history.length - 1] : null;
  const start = line ? Math.max(Math.round(line.eur), 1) : 100;
  const input = h("input", { class: "amount-input", type: "number", min: "1", step: "1", value: String(start), inputmode: "decimal", "aria-label": "Amount in euros" });
  const units = h("small", { class: "units" });
  const error = h("p", { class: "form-error", hidden: true });
  const update = () => {
    const amount = Number(input.value);
    units.textContent = last && amount > 0 ? `≈ ${(amount / last.value).toFixed(4)} units at ${eur2.format(last.value)}, last close of ${day(last.date)}` : "";
  };
  input.addEventListener("input", update);
  update();
  const place = h("button", { class: "btn btn-primary", type: "button" }, "Place order");
  place.addEventListener("click", async () => {
    place.disabled = true;
    try {
      await placeOrders([{ ticker: etf.ticker, eur: Number(input.value) }]);
      toast(`Order placed: ${eur.format(Number(input.value))} of ${etf.ticker}`);
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
      place.disabled = false;
    }
  });
  openSheet(h("h3", {}, `Buy ${etf.ticker}`), h("p", {}, sheet.name || etf.name || ""),
    h("label", { class: "amount-field" }, h("span", {}, "€"), input), units,
    h("div", { class: "quick" }, [100, 250, 500, 1000].map((v) => h("button", { class: "chip", type: "button", onclick: () => { input.value = String(v); update(); } }, eur.format(v)))),
    error, h("p", { class: "fine" }, `You decide. ReBel places your order, it does not advise you.`),
    h("div", { class: "stack" }, place, h("button", { class: "btn btn-text", type: "button", onclick: closeSheet }, "Cancel")));
}

/** The reference mix as orders the customer reviews line by line: untick any, then place them. */
/** What moved in the reference: one line per ETF, before -> after, with an arrow. */
function changesPanel(changes, limit = 5) {
  const rows = changes.slice(0, limit).map((c) => h("div", { class: "change" },
    h("span", { class: `change-arrow ${c.after > c.before ? "is-up" : "is-down"}` }, c.after > c.before ? "↗" : "↘"),
    h("b", {}, c.ticker), h("span", { class: "grow" }), h("span", { class: "change-from" }, c.before ? pct(c.before) : "new"),
    h("span", {}, "→"), h("b", {}, c.after ? pct(c.after) : "out")));
  const more = changes.length > limit ? h("p", { class: "fine" }, `And ${changes.length - limit} smaller move${changes.length - limit > 1 ? "s" : ""}.`) : null;
  return h("div", { class: "panel changes" }, rows, more);
}

/** On the portfolio: the model portfolio changed (or the portfolio drifted from it), and the orders that would match it. */
function proposalCard(proposal) {
  if (!proposal || !proposal.orders.length) return null;
  const n = proposal.orders.length;
  const title = proposal.new ? `The ${strategy().label} model portfolio changed on ${day(proposal.version)}`
    : `You have drifted from the ${strategy().label} model portfolio`;
  return h("div", { class: "section" }, h("div", { class: "proposal" },
    h("div", { class: "proposal-head" }, h("span", { class: "orb small" }), h("b", {}, title)),
    proposal.new && proposal.changes.length ? changesPanel(proposal.changes, 3) : null,
    h("p", {}, `${n} order${n > 1 ? "s" : ""} would match it again. The same update for every ${strategy().label} customer, not a recommendation for you: you decide each line.`),
    h("button", { class: "btn btn-primary", type: "button", onclick: () => ordersSheet(
      proposal.new ? "Match the updated model portfolio" : "Match the model portfolio again",
      "Untick what you do not want: each line is your own order. Sales come first, they fund the buys.", proposal.orders) },
      `See the ${n} order${n > 1 ? "s" : ""}`)));
}

/** Orders the customer reviews line by line (each {ticker, eur, side, now?, target?}): untick any, then place them. */
function ordersSheet(title, intro, orders, footnote = null) {
  const chosen = new Set(orders.map((o) => o.ticker));
  const buys = h("b", {}), sells = h("b", {});
  const place = h("button", { class: "btn btn-primary", type: "button" });
  const error = h("p", { class: "form-error", hidden: true });
  const refresh = () => {
    const picked = orders.filter((o) => chosen.has(o.ticker));
    buys.textContent = eur.format(sum(picked.filter((o) => o.side !== "SELL"), (o) => o.eur));
    sells.textContent = eur.format(sum(picked.filter((o) => o.side === "SELL"), (o) => o.eur));
    place.textContent = picked.length ? `Place ${picked.length} order${picked.length > 1 ? "s" : ""}` : "Pick at least one";
    place.disabled = !picked.length;
  };
  const rows = orders.map((o) => {
    const box = h("input", { type: "checkbox", checked: true, "aria-label": `${o.side === "SELL" ? "Sell" : "Buy"} ${o.ticker}` });
    box.addEventListener("change", () => { if (box.checked) chosen.add(o.ticker); else chosen.delete(o.ticker); refresh(); });
    const etf = (state.etfs || []).find((e) => e.ticker === o.ticker) || o;
    const why = o.target != null ? `${pct(o.now)} → ${pct(o.target)} of your portfolio` : state.sleeves[o.sleeve] || etf.theme || "";
    return h("label", { class: "basket-row" }, box, token(etf),
      h("span", { class: "grow" }, h("b", {}, o.ticker), h("small", {}, why)),
      h("span", { class: `order-side is-${(o.side || "BUY").toLowerCase()}` }, o.side === "SELL" ? "Sell" : "Buy"), h("b", {}, eur.format(o.eur)));
  });
  place.addEventListener("click", async () => {
    place.disabled = true;
    const picked = orders.filter((o) => chosen.has(o.ticker)).map((o) => ({ ticker: o.ticker, eur: o.eur, side: o.side || "BUY" }));
    try {
      await placeOrders(picked);
      toast(`${picked.length} order${picked.length > 1 ? "s" : ""} placed`);
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
      refresh();
    }
  });
  refresh();
  const anySell = orders.some((o) => o.side === "SELL");
  openSheet(h("h3", {}, title), h("p", {}, intro), h("div", { class: "basket" }, rows), footnote,
    h("div", { class: "basket-total" }, h("span", {}, "Buys"), buys),
    anySell ? h("div", { class: "basket-total" }, h("span", {}, "Sales"), sells) : null, error,
    h("p", { class: "fine" }, "You decide. ReBel places your orders at the next close, it does not advise you."),
    h("div", { class: "stack" }, place, h("button", { class: "btn btn-text", type: "button", onclick: closeSheet }, "Cancel")));
}

/** The model portfolio as orders the customer reviews line by line: untick any, then place them. */
function basketSheet() {
  const ref = state.reference;
  const locked = ref.lines.filter((l) => l.lock);
  ordersSheet("Buy this mix yourself",
    `The ${strategy().label} model portfolio for ${eur.format(ref.amount)}. Untick what you do not want: each line is your own order.`,
    ref.lines.filter((l) => !l.lock).map((l) => ({ ticker: l.ticker, eur: l.eur, side: "BUY", sleeve: l.sleeve })),
    locked.length ? h("p", { class: "fine" }, `Locked, not included: ${locked.map((l) => `${l.ticker} (${l.lock.toLowerCase()})`).join(", ")}.`) : null);
}

/** Sell part or all of a holding. */
function sellSheet(etf, holding) {
  const input = h("input", { class: "amount-input", type: "number", min: "1", step: "1", value: String(Math.floor(holding.value)), inputmode: "decimal", "aria-label": "Amount in euros" });
  const error = h("p", { class: "form-error", hidden: true });
  const place = h("button", { class: "btn btn-primary", type: "button" }, "Place order");
  place.addEventListener("click", async () => {
    place.disabled = true;
    const amount = Math.min(Number(input.value), holding.value);
    try {
      await placeOrders([{ ticker: etf.ticker, eur: amount, side: "SELL" }]);
      toast(`Order placed: sell ${eur.format(amount)} of ${etf.ticker}`);
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
      place.disabled = false;
    }
  });
  openSheet(h("h3", {}, `Sell ${etf.ticker}`), h("p", {}, `You hold ${eur2.format(holding.value)} of it.`),
    h("label", { class: "amount-field" }, h("span", {}, "€"), input),
    h("div", { class: "quick" }, [0.25, 0.5, 1].map((part) => h("button", { class: "chip", type: "button",
      onclick: () => { input.value = String(Math.floor(holding.value * part * 100) / 100); } }, part === 1 ? "All" : `${part * 100}%`))),
    error, h("p", { class: "fine" }, "You decide. ReBel places your order, it does not advise you."),
    h("div", { class: "stack" }, place, h("button", { class: "btn btn-text", type: "button", onclick: closeSheet }, "Cancel")));
}

async function placeOrders(orders) {
  const out = await api("/api/order", { customer: state.id, orders });
  Object.assign(state, { orders: out.state.orders, unlocked: out.state.unlocked, portfolio: out.portfolio, tab: "portfolio" });
  renderMain();
  renderWelcome();
  go("main");
  sync();
}

// ---- The check that opens complex products -------------------------------------------------------------------------
function quizSheet() {
  const picked = {};
  const submit = h("button", { class: "btn btn-primary", type: "button", disabled: true }, "Check my answers");
  const result = h("div", { class: "quiz-result", hidden: true });
  const blocks = state.quiz.map((q, i) => {
    const notes = h("p", { class: "quiz-note", hidden: true });
    const chips = h("div", { class: "quiz-choices" }, q.choices.map((c) => {
      const chip = h("button", { class: "choice", type: "button" }, c.label);
      chip.addEventListener("click", () => {
        picked[q.id] = c.value;
        for (const other of chips.children) other.classList.toggle("is-on", other === chip);
        submit.disabled = Object.keys(picked).length < state.quiz.length;
      });
      return chip;
    }));
    return { id: q.id, notes, el: h("div", { class: "quiz-q" }, h("b", {}, `${i + 1}. ${q.text}`), chips, notes) };
  });
  submit.addEventListener("click", async () => {
    submit.disabled = true;
    try {
      const out = await api("/api/quiz", { customer: state.id, answers: picked });
      blocks.forEach((b, i) => { b.notes.textContent = out.notes[i]; b.notes.hidden = false; });
      result.hidden = false;
      if (out.passed) {
        state.unlocked = true;
        await load();
        renderMain();
        result.replaceChildren(h("b", {}, "Unlocked."), h("p", {}, "Leveraged, inverse and crypto ETFs are open to you. They can fall fast: keep them small."),
          h("button", { class: "btn btn-ghost", type: "button", onclick: closeSheet }, "Close"));
        result.className = "quiz-result is-good";
      } else {
        result.replaceChildren(h("b", {}, `${out.right} of ${state.quiz.length} right.`), h("p", {}, "Read the notes, then try again whenever you like."),
          h("button", { class: "btn btn-ghost", type: "button", onclick: quizSheet }, "Try again"));
        result.className = "quiz-result is-wait";
      }
      sync();
    } catch (e) {
      result.replaceChildren(h("p", {}, e.message));
      result.hidden = false;
    }
  });
  openSheet(h("h3", {}, "Complex products: 3 questions"),
    h("p", {}, "Leveraged, inverse and crypto ETFs can lose a lot, fast. Show you know how, and they open."),
    ...blocks.map((b) => b.el), result, h("div", { class: "stack" }, submit, h("button", { class: "btn btn-text", type: "button", onclick: closeSheet }, "Not now")));
}

// ---- The presenter's side panels ---------------------------------------------------------------------------
const card = (title, aside, ...children) => h("div", { class: "card" }, h("h3", {}, title, aside ? h("span", {}, aside) : null), ...children);
const rowsOf = (pairs) => h("div", { class: "rows" }, pairs.map(([k, v]) => h("div", {}, h("span", { class: "k" }, k), h("span", { class: "v" }, v))));

/** The probability of each archetype: one bar each, in the same order from start to end, the leader in colour. */
function oddsCard() {
  if (!state.odds && state.archetype) {
    return card("Style: archetype", archetype().label, h("p", { class: "quiet" }, state.why || "Found in the chat."));
  }
  if (!state.odds) return card("Style: probability of each archetype", null, h("p", { class: "quiet" }, "Starts with the first question."));
  const top = Math.max(...Object.values(state.odds));
  const bars = Object.entries(state.odds).map(([key, p]) => h("div", { class: p === top ? "odd is-top" : "odd" },
    h("span", { class: "k" }, state.archetypes[key].label), h("span", { class: "track" }, h("i", { style: `width:${Math.max(p * 100, 1)}%` })),
    h("span", { class: "v" }, pct(p))));
  const from = state.seen.map(([name, value]) => `${name}: ${value}`).join(" · ");
  return card("Style: probability of each archetype", state.archetype ? "final" : "after each answer", h("div", { class: "odds" }, bars),
    h("p", { class: "quiet" }, `Starts from: ${from || "nothing known"}`));
}

function levelCard() {
  if (!state.strategy) {
    return card("Risk level: fixed rules", null, h("p", { class: "quiet" }, "Set once the answers are in: horizon, reaction to a fall, knowledge, buffer. Never by the AI."));
  }
  return card("Risk level: fixed rules", strategy().label,
    h("div", { class: "level-row" }, ["defensive", "balanced", "opportunity"].map((key) =>
      h("span", { class: key === state.strategy ? `lvl is-on s-${key}` : "lvl" }, state.strategies[key].label))),
    ticks(state.strategy_why), state.traded === state.strategy ? h("p", { class: "quiet" }, "The strategy our team trades in the competition.") : null);
}

/** What the code holds right now: the archetype's probabilities, the risk level, the suitability sheet, the checks. */
function sync() {
  const asked = state.left == null ? 0 : state.questions - state.left;
  if ($("progress")) $("progress").style.width = `${Math.round((asked / state.questions) * 100)}%`;
  if ($("send")) $("send").disabled = state.busy || !state.question;
  if ($("input")) $("input").placeholder = state.strategy ? "Your result is ready" : "Or type your answer";
  $("inspector").replaceChildren(
    levelCard(),
    oddsCard(),
    card("Suitability sheet", state.sheet.length ? `${state.sheet.length} answers` : null,
      state.sheet.length ? rowsOf(state.sheet) : h("p", { class: "quiet" }, "Filled by the same questions.")),
    card("Checks by code", null, state.flags.length
      ? state.flags.map((flag) => h("div", { class: "flag" }, h("span", { icon: ICON.alert }), flag))
      : h("div", { class: "ok-line" }, h("span", { icon: ICON.check }), "No contradiction found")),
    state.strategy ? card("What the customer did", null, rowsOf([
      ["Orders placed", String(state.orders.length)],
      ["Invested", eur.format(sum(state.orders, (o) => o.eur))],
      ["Complex products", strategy().complex ? (state.unlocked ? "unlocked by the check" : "locked until the check") : "not at this level"],
      ["Lessons right", `${Object.values(state.lessons || {}).filter(Boolean).length} of ${Object.keys(state.lessonBook).length}`],
      ["Learning streak", `${state.streak ? state.streak.days : 0} day${state.streak && state.streak.days === 1 ? "" : "s"}`]])) : "");
  $("people").replaceChildren(...state.customers.map((c) =>
    h("button", { class: c.id === state.id ? "person is-on" : "person", type: "button", onclick: () => selectCustomer(c.id) },
      avatar(c), h("span", {}, h("b", {}, `${c.first_name}, ${c.age}`), h("small", {}, c.status)))));
}

// ---- Customers ----------------------------------------------------------------------------------------------
async function selectCustomer(id) {
  run += 1;
  const { state: saved, known } = await api(`/api/state?customer=${id}`);
  Object.assign(state, blank(), { id, known }, saved ? { ...saved, left: 0 } : {});
  try { localStorage.setItem("rebel.customer", id); } catch { /* private window: the choice is not kept */ }
  renderWelcome();
  renderConsent();
  go("welcome");
  sync();
}

async function startOver() {
  await api("/api/reset", { customer: state.id });
  await selectCustomer(state.id);
}

async function boot() {
  const start = await api("/api/start");
  Object.assign(state, { customers: start.customers, strategies: start.strategies, archetypes: start.archetypes, traded: start.traded,
    questions: start.questions, accountData: start.account_data, coach: start.coach, sleeves: start.sleeves, quiz: start.quiz,
    lessonBook: start.lessons, coreEtfs: start.core_etfs });
  let last = null;
  try { last = localStorage.getItem("rebel.customer"); } catch { /* private window */ }
  await selectCustomer(state.customers.some((c) => c.id === last) ? last : state.customers[0].id);
  const tick = () => { $("clock").textContent = new Date().toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" }); };
  tick();
  setInterval(tick, 30_000);
}

$("backdrop").addEventListener("click", closeSheet);
$("start-over").addEventListener("click", startOver);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeSheet(); });
boot();

"""What a customer may buy, and what they hold: plain rules on plain data.

ReBel is execution-only: the customer places every order. These rules only say what is open to them (their strategy,
the check on complex products, their own rules) and compare what they hold with their strategy's reference portfolio.
The comparison points to kinds of assets, never to an order.

Standard library only: the online demo runs this file in the browser as it is (mobile/demo.py), so the rules exist
once.
"""
from agents.profiler import QUESTIONS
from data.profiles import COMPLEX_FAMILIES, FAMILY_SLEEVE, SLEEVES, STRATEGIES

# The customer's rules (the coach's last question): which ETFs each one leaves out. etf: {"ticker", "family"}.
RULED_OUT = {
    "weapons": lambda etf: etf["ticker"] == "DEFENSE",
    "crypto": lambda etf: etf["family"] == "crypto",
    "leverage": lambda etf: etf["family"] == "leveraged_inverse",
    "fossil": lambda etf: etf["ticker"] in ("WORLD ENERGY", "OIL & GAS E&P"),
}
CLOSE, FAR = 0.05, 0.15  # a sleeve this close to the reference is fine; beyond FAR it is a gap
MIN_ORDER_EUR = 1
MIN_PROPOSAL = 0.01  # an order to follow the reference is proposed only above this share of the portfolio...
MIN_PROPOSAL_EUR = 10  # ...and this amount
DRIFT = 0.05  # with no new version, the orders to match the model portfolio are offered once a line is this far off
SIDES = ("BUY", "SELL")


def rule_name(rule: str) -> str:
    return QUESTIONS["rules"]["answers"][rule][0]


def ruled_out_by(etf: dict, rules: list[str] | None) -> str | None:
    """The customer's rule that leaves this ETF out, or None."""
    return next((rule for rule in rules or [] if RULED_OUT[rule](etf)), None)


def lock(etf: dict, strategy: str, unlocked: bool, rules: list[str] | None = None) -> str:
    """Why the customer cannot buy this ETF, in words, or "" when they can."""
    rule = ruled_out_by(etf, rules)
    if rule:
        return f"You ruled out {rule_name(rule).lower()}"
    if etf["family"] in COMPLEX_FAMILIES:
        if not STRATEGIES[strategy]["complex"]:
            return f"Not part of the {STRATEGIES[strategy]['label']} risk level"
        if not unlocked:
            return "Pass the 3-question check to unlock"
    return ""


def decorate(lines: list[dict], strategy: str, unlocked: bool, rules: list[str] | None = None) -> list[dict]:
    """The same lines, each with `lock`: why it cannot be bought, or ""."""
    return [{**line, "lock": lock(line, strategy, unlocked, rules)} for line in lines]


def check_order(etf: dict | None, eur, strategy: str, unlocked: bool, rules: list[str] | None = None,
                side: str = "BUY", held_eur: float = 0.0) -> str:
    """What is wrong with an order, in words, or "" when it can be placed. A buy must be open to the customer; a sell
    must not be above what they hold (`held_eur`, at the last close)."""
    if etf is None:
        return "Unknown ETF"
    if side not in SIDES:
        return "An order is a buy or a sell"
    if isinstance(eur, bool) or not isinstance(eur, (int, float)) or not eur >= MIN_ORDER_EUR:
        return f"The amount must be at least EUR {MIN_ORDER_EUR}"
    if side == "SELL":
        return "" if eur <= held_eur + 0.01 else f"You hold EUR {held_eur:,.2f} of it"
    return lock(etf, strategy, unlocked, rules)


def sleeve_of(etf: dict, reference: list[dict]) -> str:
    """Where an ETF sits: its sleeve in the reference portfolio, else the sleeve of its family, else the themes."""
    for line in reference:
        if line["ticker"] == etf["ticker"]:
            return line["sleeve"]
    return FAMILY_SLEEVE.get(etf["family"], "satellites")


def holdings(orders: list[dict], last: dict[str, float], etfs: dict[str, dict], reference: list[dict]) -> dict:
    """What the customer holds, valued at the last close, compared with the reference portfolio.

    orders: the customer's orders, each {"ticker", "eur", "units", "side"} (side BUY when missing; units None when
    no price was known: then the position is worth what was paid). A sale takes off its share of what was paid.
    last: ticker -> last close. etfs: ticker -> {"ticker", "name", "theme", "family"}. reference: the lines of the
    strategy's reference portfolio, each {"ticker", "sleeve", "weight"}.
    """
    book = {}
    for order in orders:
        line = book.setdefault(order["ticker"], {"eur": 0.0, "units": 0.0, "priced": True})
        if order.get("side", "BUY") == "SELL":
            units = order.get("units") or 0.0
            part = min(units / line["units"], 1.0) if line["units"] else min(order["eur"] / line["eur"], 1.0) if line["eur"] else 1.0
            line["eur"] -= line["eur"] * part
            line["units"] -= units if line["units"] else 0.0
            continue
        line["eur"] += order["eur"]
        if order.get("units"):
            line["units"] += order["units"]
        else:
            line["priced"] = False
    book = {t: line for t, line in book.items() if line["eur"] > 0.005 and (line["units"] > 1e-9 or not line["priced"])}
    lines = []
    for ticker, line in book.items():
        etf = etfs[ticker]
        value = line["units"] * last[ticker] if line["priced"] and ticker in last else line["eur"]
        lines.append({"ticker": ticker, "name": etf["name"], "theme": etf["theme"], "family": etf["family"],
                      "sleeve": sleeve_of(etf, reference), "invested": round(line["eur"], 2), "value": round(value, 2),
                      "gain": value / line["eur"] - 1 if line["eur"] else 0.0})
    value = sum(line["value"] for line in lines)
    invested = sum(line["invested"] for line in lines)
    for line in lines:
        line["weight"] = line["value"] / value if value else 0.0
    lines.sort(key=lambda line: -line["value"])
    target = {key: sum(line["weight"] for line in reference if line["sleeve"] == key) for key in SLEEVES}
    held = {key: sum(line["weight"] for line in lines if line["sleeve"] == key) for key in SLEEVES}
    health, ideas = [], []
    if lines:
        for key, name in SLEEVES.items():
            gap = held[key] - target[key]
            if not held[key] and not target[key]:
                continue
            state = "ok" if abs(gap) <= CLOSE else "watch" if abs(gap) <= FAR else "gap"
            health.append({"sleeve": key, "name": name, "held": held[key], "target": target[key], "state": state})
            if gap < -CLOSE:
                ideas.append(f"{name}: about {round(target[key] * 100)}% is in the model portfolio, you hold "
                             f"{round(held[key] * 100)}%")
            elif gap > CLOSE:
                ideas.append(f"{name}: {round(held[key] * 100)}% of what you hold, against {round(target[key] * 100)}% "
                             "in the model portfolio")
    return {"lines": lines, "invested": round(invested, 2), "value": round(value, 2),
            "gain": value / invested - 1 if invested else 0.0,
            "sleeves": [{"key": key, "name": name, "weight": held[key]} for key, name in SLEEVES.items() if held[key]],
            "health": health, "ideas": ideas}


def mix_history(orders: list[dict], histories: dict[str, list[dict]]) -> list[dict]:
    """What the ETFs the customer holds today, in today's units, were worth on each past date of their charts:
    [{"date", "value"}], from the first date every one of them has a price. A position bought without a known price
    counts at what was paid. Empty when no position has units.

    histories: ticker -> the ETF's chart points, [{"date", "value"}] in date order."""
    units: dict[str, float] = {}
    fixed = 0.0
    for order in orders:
        if order.get("units") and histories.get(order["ticker"]):
            units[order["ticker"]] = units.get(order["ticker"], 0.0) + order["units"]
        else:
            fixed += order["eur"]
    if not units:
        return []
    series = {ticker: {p["date"]: p["value"] for p in histories[ticker]} for ticker in units}
    last: dict[str, float] = {}
    out = []
    for date in sorted({d for points in series.values() for d in points}):
        for ticker, points in series.items():
            if date in points:
                last[ticker] = points[date]
        if len(last) == len(units):
            out.append({"date": date, "value": round(fixed + sum(units[t] * last[t] for t in units), 2)})
    return out


def mix_curve(weights: dict[str, float], histories: dict[str, list[dict]]) -> list[dict]:
    """What 1 in a mix became, point by point of the ETFs' charts, put back to its weights at every point: [{"date",
    "value"}]. An ETF without a price at a point counts as cash at 0% there (one not listed yet, for instance)."""
    series = {t: {p["date"]: p["value"] for p in histories.get(t, [])} for t, w in weights.items() if w > 0}
    dates = sorted({d for points in series.values() for d in points})
    value, last, out = 1.0, {}, []
    for date in dates:
        step = 0.0
        for ticker, w in weights.items():
            price = series.get(ticker, {}).get(date)
            if price is not None:
                if ticker in last:
                    step += w * (price / last[ticker] - 1)
                last[ticker] = price
        value *= 1 + step
        out.append({"date": date, "value": round(value, 6)})
    return out


def changes(before: dict[str, float], after: dict[str, float]) -> list[dict]:
    """What moved between two versions of a reference, biggest move first: [{"ticker", "before", "after"}]. Moves
    under half a percent are left out."""
    moved = [{"ticker": t, "before": round(before.get(t, 0.0), 4), "after": round(after.get(t, 0.0), 4)}
             for t in set(before) | set(after) if abs(after.get(t, 0.0) - before.get(t, 0.0)) >= 0.005]
    return sorted(moved, key=lambda m: (-abs(m["after"] - m["before"]), m["ticker"]))


def rebalance(held: list[dict], reference: list[dict], extra_eur: float = 0.0) -> list[dict]:
    """The orders that bring what the customer holds back to their reference: [{"ticker", "side", "eur", "now",
    "target"}], sells first (they fund the buys). held: lines of `holdings` ({"ticker", "value"}); reference: lines
    with {"ticker", "weight", "lock"}. A locked ETF is never bought: its share stays in cash. Orders under
    MIN_PROPOSAL of the portfolio or MIN_PROPOSAL_EUR are left out. `extra_eur`: cash the customer adds."""
    total = sum(line["value"] for line in held) + extra_eur
    if total <= 0:
        return []
    now = {line["ticker"]: line["value"] for line in held}
    target = {line["ticker"]: line["weight"] * total for line in reference if not line.get("lock")}
    orders = []
    for ticker in sorted(set(now) | set(target)):
        gap = target.get(ticker, 0.0) - now.get(ticker, 0.0)
        if abs(gap) >= max(MIN_PROPOSAL * total, MIN_PROPOSAL_EUR):
            orders.append({"ticker": ticker, "side": "BUY" if gap > 0 else "SELL", "eur": round(abs(gap), 2),
                           "now": round(now.get(ticker, 0.0) / total, 4), "target": round(target.get(ticker, 0.0) / total, 4)})
    return sorted(orders, key=lambda o: (o["side"] != "SELL", -o["eur"]))


def proposal_orders(lines: list[dict], reference: list[dict], new: bool) -> list[dict]:
    """The orders the portfolio offers (`rebalance`): all of them when the model portfolio has a new version since the
    customer's last order (`new`); otherwise only once one line is DRIFT or more away from it, so small moves of the
    market do not nag the customer."""
    orders = rebalance(lines, reference) if lines else []
    return orders if new or any(abs(o["now"] - o["target"]) >= DRIFT for o in orders) else []

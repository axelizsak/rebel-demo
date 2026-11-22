"""The three strategies and the five customer archetypes: two layers, kept apart.

- A strategy (Defensive, Balanced, Opportunity) is the customer's risk level. Rules on the suitability answers set it
  (agents/profiler.py), never the model. It decides WHAT: the reference portfolio the customer is shown and the
  products open to them. Opportunity is also the strategy the team trades in the competition (TRADED).
- An archetype (the team's five, v1 of 17 November 2026: hypotheses from public data, not validated with customers)
  is the kind of customer. The coach guesses it from the answers. It decides HOW: what the coach helps with first
  and the tips it gives. It never decides an asset.

Rheindata is execution-only: a reference portfolio is information, the customer
places each order. A strategy's reference portfolio is fixed: a share per sleeve (SLEEVES), the same ETFs in the core
sleeves for everyone (SLEEVE_ETFS), the strategy's own themes in the satellites. The numbers are the team's proposal,
to challenge with backtest/README.md, section 7.
"""
# The sleeves of a reference portfolio, in the order the app shows them, and what the customer reads.
SLEEVES = {"core_equity": "Core equity", "bonds": "Bonds", "gold": "Gold", "satellites": "Themes", "cash": "Cash"}
# The ETFs of each core sleeve and their share of the sleeve, the same for every strategy.
SLEEVE_ETFS = {
    "core_equity": {"WORLD": 0.70, "EUROPE 600": 0.15, "EMMKT": 0.15},
    "bonds": {"GLOBAL AGG BOND": 0.60, "EUR GOVT BOND": 0.40},
    "gold": {"GOLD": 1.0},
    "cash": {"OVERNIGHT CASH": 1.0},
}
# Complex products (families of data/etf_universe.csv): open only to a strategy that allows them, and only once the
# customer has passed the short check on them (agents/profiler.py, QUIZ). In execution-only, complex products call
# for an appropriateness test; ours is a prototype of one, to be confirmed by compliance.
COMPLEX_FAMILIES = {"leveraged_inverse", "crypto"}
# The sleeve of an ETF outside the core sleeves, from its family (data/etf_universe.csv): anything else is a theme.
FAMILY_SLEEVE = {"broad_equity": "core_equity", "bonds": "bonds", "gold": "gold", "cash": "cash"}
EQUITY_SLEEVES = ("core_equity", "satellites")  # the sleeves that move with the stock market


def sleeve_of(ticker: str, family: str) -> str:
    """Where an ETF sits: its core sleeve (SLEEVE_ETFS), else the sleeve of its family, else the themes."""
    for sleeve, etfs in SLEEVE_ETFS.items():
        if ticker in etfs:
            return sleeve
    return FAMILY_SLEEVE.get(family, "satellites")


# level: 1 (lowest risk) to 3. sleeves: the share of the portfolio in each sleeve. themes: the ETFs of the satellites
# sleeve, in equal parts. complex: whether complex products can be opened at this level.
# limits: the envelope of the strategy when the agents trade it (agents/portfolio.py `within_strategy`): at most
# equity_max in shares (core and themes), themes_max in themes, complex_max in complex products. What the themes
# limit cuts goes to the core ETFs, what the equity limit cuts goes to the bonds, what the complex limit cuts stays
# in cash. Each limit leaves room around the reference portfolio, so the agents can lean one way or the other.
STRATEGIES = {
    "defensive": {
        "label": "Defensive",
        "level": 1,
        "tagline": "Protect first, grow slowly.",
        "fits": "money you may need within a few years, or a fall that would make you sell",
        "sleeves": {"core_equity": 0.30, "bonds": 0.40, "gold": 0.10, "satellites": 0.10, "cash": 0.10},
        "themes": ["HEALTH CARE", "STAPLES"],
        "complex": False,
        "limits": {"equity_max": 0.45, "themes_max": 0.20, "complex_max": 0.0},
    },
    "balanced": {
        "label": "Balanced",
        "level": 2,
        "tagline": "Grow, with a cushion.",
        "fits": "money you will not need for years, and a fall you would wait out",
        "sleeves": {"core_equity": 0.50, "bonds": 0.25, "gold": 0.10, "satellites": 0.10, "cash": 0.05},
        "themes": ["SEMIS", "HEALTH CARE"],
        "complex": False,
        "limits": {"equity_max": 0.70, "themes_max": 0.25, "complex_max": 0.0},
    },
    "opportunity": {
        "label": "Opportunity",
        "level": 3,
        "tagline": "More growth, bigger swings.",
        "fits": "a long horizon, a fall you would buy into, and the knowledge to match",
        "sleeves": {"core_equity": 0.55, "bonds": 0.10, "gold": 0.05, "satellites": 0.30, "cash": 0.00},
        "themes": ["SEMIS", "NASDAQ", "URANIUM", "DEFENSE", "BITCOIN"],
        "complex": True,
        "limits": {"equity_max": 0.95, "themes_max": 0.50, "complex_max": 0.10},
    },
}
# The strategy the team trades in the competition until it chooses another in the cockpit (team decision, 18 November
# 2026). The choices are logged (agents/model_portfolios.py `traded`): every machine trades the same one.
TRADED = "opportunity"

# typical: the strategy the archetype most often ends in (the cockpit shows it; the customer's own answers decide).
# lessons: the three lessons the coach offers first (data/lessons.py). tips: what the customer is told on the way.
ARCHETYPES = {
    "first_step_starter": {
        "label": "First-step starter",
        "tagline": "Small steps, long runway.",
        "who": "starting out: a student or in a first job, with a small amount and a long time ahead",
        "goal": "start, learn and build the habit",
        "typical": "balanced",
        "lessons": ["etf", "spread", "time"],
        "tips": ["A savings buffer comes before the first euro invested"],
    },
    "goal_builder": {
        "label": "Goal builder",
        "tagline": "A home first. Wealth after.",
        "who": "employed, often renting, saving for a home and for the long term at the same time",
        "goal": "a home deposit in 2 to 5 years, and long-term wealth",
        "typical": "balanced",
        "lessons": ["two_pots", "fall_before_buy", "costs"],
        "tips": ["The home money moves to safer ETFs as the purchase date nears"],
    },
    "self_directed_trader": {
        "label": "Self-directed trader",
        "tagline": "Your picks, on a solid core.",
        "who": "already invests alone, often at a neobroker or in crypto, and wants control and low costs",
        "goal": "control, low costs and fast gains",
        "typical": "opportunity",
        "lessons": ["read_sheet", "leverage_crypto", "core_satellite"],
        "tips": ["Your risk level follows the loss you can bear, not the one you would like to take"],
    },
    "cautious_saver": {
        "label": "Cautious saver",
        "tagline": "Slow in. Steady on.",
        "who": "has savings and has never invested, for fear of losses and of mistakes",
        "goal": "children, a buffer and a later pension",
        "typical": "defensive",
        "lessons": ["falls_pass", "inflation", "step_by_step"],
        "tips": ["Go in step by step over 6 to 12 months", "The buffer stays in savings"],
    },
    "late_starter": {
        "label": "Late starter",
        "tagline": "Catch up, calmly.",
        "who": "45 or older with larger savings, starting late to close a pension gap",
        "goal": "close the pension gap",
        "typical": "defensive",
        "lessons": ["pension_gap", "tax_sell", "pension_saving"],
        "tips": ["Plan sales around the yearly EUR 10,000 capital gains exemption"],
    },
}

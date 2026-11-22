"""The short lessons of the customer app: a few plain sentences, then one question with the reason behind each answer.

Each archetype (data/profiles.py) gets three lessons first; every customer can open them all. A lesson teaches, it
never recommends a product. Figures in a lesson are worked examples, not forecasts. Rules that can change (tax,
pension savings) are said to be checked with an adviser.

answers: key -> (what the customer taps, why it is right or wrong). right: the key of the right answer.
"""
LESSONS = {
    "etf": {
        "title": "What an ETF is",
        "text": ["An ETF is a fund you buy on the stock exchange, like a share.",
                 "One ETF holds many companies at once: an MSCI World ETF holds about 1,400 large companies in 23 "
                 "countries.",
                 "Its yearly cost is low, often 0.1% to 0.3%."],
        "question": "You buy EUR 100 of an MSCI World ETF. What do you own?",
        "right": "slice",
        "answers": {
            "slice": ("A small slice of about 1,400 companies", "Right: the ETF holds them for you, so EUR 100 is "
                                                                "spread across all of them."),
            "issuer": ("Shares of the company that sells the ETF", "No: you own a part of the fund, which holds the "
                                                                   "companies of the index."),
            "loan": ("A loan to 23 countries", "No: that would be a bond fund. A world equity ETF holds company "
                                               "shares."),
        },
    },
    "spread": {
        "title": "Why spreading your money lowers the risk",
        "text": ["If all your money is in one company and it fails, you lose everything.",
                 "In a fund of hundreds of companies, the same failure costs a fraction of a percent.",
                 "Spreading also across regions and kinds of assets (shares, bonds, gold) smooths the ride further. "
                 "It lowers the risk of a big loss; it does not stop every dip."],
        "question": "Which is riskier?",
        "right": "one",
        "answers": {
            "one": ("All my money in one company", "Right: one bad piece of news can wipe it out."),
            "world": ("The same money in a world ETF", "No: a world ETF spreads it over hundreds of companies."),
            "same": ("They are the same", "No: one company can fail; hundreds rarely fail together."),
        },
    },
    "time": {
        "title": "A monthly plan, and why time does the work",
        "text": ["Investing the same amount every month buys more units when prices are low and fewer when they are "
                 "high.",
                 "Over long periods, gains earn gains of their own: compounding.",
                 "Example, not a promise: EUR 50 a month for 20 years is EUR 12,000 put in. At 5% a year it would "
                 "become about EUR 20,500."],
        "question": "Prices fall while you invest EUR 50 every month. Your EUR 50 now buys...",
        "right": "more",
        "answers": {
            "more": ("More units", "Right: a lower price means more units for the same EUR 50."),
            "fewer": ("Fewer units", "No: a lower price means more units for the same money."),
            "same": ("The same units", "No: the number of units follows the price."),
        },
    },
    "two_pots": {
        "title": "Two pots: the home money and the long-term money",
        "text": ["Money you need in 2 to 5 years should not ride the stock market: a fall just before you buy can "
                 "cost part of the deposit.",
                 "Keep it in a safe pot (savings, short bonds) and invest only the long-term pot in ETFs."],
        "question": "You buy a flat in 3 years. Where does the deposit go?",
        "right": "safe",
        "answers": {
            "safe": ("A safe pot: savings or short bonds", "Right: the date is close, so a fall would have no time "
                                                           "to recover."),
            "equity": ("An equity ETF, it grows more", "No: over 3 years it can also be down when you need it."),
            "crypto": ("Crypto, for a quick gain", "No: crypto can lose most of its value in a year."),
        },
    },
    "fall_before_buy": {
        "title": "What a fall means a year before you buy",
        "text": ["Shares can lose a fifth of their value in a few months, and take years to recover.",
                 "Over 15 years that hardly matters. One year before you buy a home, it can cost part of the "
                 "deposit.",
                 "That is why the home money moves to safer ETFs as the date nears."],
        "question": "Why move the home money to safer ETFs as the date nears?",
        "right": "late_fall",
        "answers": {
            "late_fall": ("So a late fall cannot eat the deposit", "Right: close to the date there is no time left to "
                                                                   "recover."),
            "earn": ("Because safe ETFs earn more", "No: they usually earn less. They are steadier."),
            "bank": ("Because the bank asks for it", "No: it protects your own deposit."),
        },
    },
    "costs": {
        "title": "How the costs of a fund add up",
        "text": ["A fund takes a yearly fee from its value (the TER).",
                 "Example: at 5% a year before costs, a 1% fee takes about a sixth of what you would have after 20 "
                 "years. A 0.2% fee takes about 4%."],
        "question": "Two world ETFs on the same index: one costs 0.2% a year, the other 1%. Over 20 years...",
        "right": "cheaper",
        "answers": {
            "cheaper": ("The cheaper one keeps more of the gain", "Right: same index, so the fee is the difference."),
            "nothing": ("It makes no difference", "No: 0.8% a year adds up to a lot over 20 years."),
            "safer": ("The dearer one is safer", "No: both hold the same companies. Only the fee differs."),
        },
    },
    "read_sheet": {
        "title": "Read an ETF sheet: trend, macro and news",
        "text": ["Trend: is the price above its average, and is the return positive?",
                 "Macro: does today's economy help or hurt this ETF? News: what our analyst reads for the next few "
                 "days, with the other side of the argument.",
                 "None of them is a forecast to bank on. Together they tell you what the market is doing now."],
        "question": "The trend is up, the news leans negative. What does it tell you?",
        "right": "disagree",
        "answers": {
            "disagree": ("The signals disagree, so neither is certain", "Right: read both, and decide knowing it can "
                                                                        "go either way."),
            "buy": ("Buy now: the trend wins", "No: no signal wins for sure. They are information, not orders."),
            "sell": ("Sell now: the news wins", "No: no signal wins for sure. They are information, not orders."),
        },
    },
    "leverage_crypto": {
        "title": "Leverage and crypto: what can go wrong",
        "text": ["A 3x leveraged ETF moves three times the index each day, and resets every day: in a choppy market it "
                 "loses value even if the index ends flat.",
                 "Bitcoin fell about three quarters from its 2021 peak to its 2022 low.",
                 "Keep them small, and only with money you could lose."],
        "question": "An index gains 10%, then loses 10% the next day. A 3x ETF on it ends...",
        "right": "nine",
        "answers": {
            "nine": ("Down about 9%", "Right: +30% then -30% leaves 0.91, while the index is down only 1%."),
            "three": ("Down about 3%", "No: the daily reset makes it lose more: +30% then -30% leaves 0.91."),
            "flat": ("Flat", "No: even the index ends down 1%, and the 3x ETF about 9%."),
        },
    },
    "core_satellite": {
        "title": "Core and satellites",
        "text": ["Keep most of your money in a broad core (world shares, bonds) and your own picks in satellites: "
                 "about a third, or less.",
                 "If a pick goes wrong, the core carries you."],
        "question": "Your theme ETF doubles and becomes half of what you hold. What has changed?",
        "right": "risk",
        "answers": {
            "risk": ("My risk: I now depend on one theme", "Right: a good run also concentrates the risk."),
            "nothing": ("Nothing, it is a gain", "No: the gain is real, but now one theme drives half of it."),
            "fees": ("My fees", "No: the fees barely move. The risk does."),
        },
    },
    "falls_pass": {
        "title": "What a fall looks like, and why it passes",
        "text": ["World shares fell by a third or more three times since 2000: in 2000-03, in 2008 and in 2020.",
                 "Each time they recovered: once in months, once over many years.",
                 "Selling in the fall turns a loss on paper into a real one."],
        "question": "Your ETF falls 20%. If you sell now...",
        "right": "real",
        "answers": {
            "real": ("The loss becomes real", "Right: on paper it can still recover; once sold, it cannot."),
            "avoid": ("I avoid the loss", "No: the loss already happened. Selling only makes it final."),
            "refund": ("The fall is refunded", "No: nobody refunds a fall."),
        },
    },
    "inflation": {
        "title": "Savings account or ETF: what inflation does",
        "text": ["With prices rising 2% a year, EUR 10,000 kept at 0% buys about EUR 8,200 of today's goods after 10 "
                 "years.",
                 "An ETF can lose value in a given year, but over long periods shares have beaten inflation.",
                 "That is why a buffer stays in savings and long-term money is invested."],
        "question": "Prices rise 2% a year and your savings earn 0%. After 10 years your money...",
        "right": "less",
        "answers": {
            "less": ("Buys less than today", "Right: the amount is the same, but everything costs more."),
            "same": ("Buys the same", "No: prices went up, so the same amount buys less."),
            "more": ("Buys more", "No: at 0%, it cannot keep up with rising prices."),
        },
    },
    "step_by_step": {
        "title": "Going in step by step",
        "text": ["Investing a large amount in parts, over 6 to 12 months, means a fall just after you start hurts "
                 "less.",
                 "It may earn a little less if markets rise meanwhile, but it is easier to live with."],
        "question": "Why go in step by step?",
        "right": "softer",
        "answers": {
            "softer": ("A fall just after the start hurts less", "Right: only part of the money is in when it falls."),
            "always": ("It always earns more", "No: if markets rise, going in at once earns more."),
            "never": ("It avoids all losses", "No: it softens them; it does not avoid them."),
        },
    },
    "pension_gap": {
        "title": "The pension gap in your own numbers",
        "text": ["The legal pension often pays well under your last salary.",
                 "The gap is what you fill yourself: the earlier you start, the more time works for you."],
        "question": "You start 10 years later. To reach the same amount you must...",
        "right": "more",
        "answers": {
            "more": ("Put in more each month", "Right: fewer years, and less time for gains to earn gains."),
            "same": ("Put in the same", "No: with fewer years, the same amount ends lower."),
            "less": ("Put in less", "No: starting later always asks for more."),
        },
    },
    "tax_sell": {
        "title": "Tax when you sell, and the yearly exemption",
        "text": ["In Belgium, gains on shares and ETFs are taxed when you sell, with a first slice of gains exempt "
                 "each year (EUR 10,000 in our example).",
                 "Spreading sales over several years can keep more of the gains under the exemption.",
                 "Tax rules change: check the current ones with an adviser."],
        "question": "You have EUR 18,000 of gains. Selling half this year and half next year...",
        "right": "both",
        "answers": {
            "both": ("Can keep both halves under the yearly exemption", "Right: EUR 9,000 a year stays under "
                                                                        "EUR 10,000."),
            "double": ("Doubles the tax", "No: spreading the sales can lower it."),
            "nothing": ("Changes nothing", "No: the exemption counts per year."),
        },
    },
    "pension_saving": {
        "title": "Pension savings and ETFs side by side",
        "text": ["Belgian pension savings give a tax reduction each year, up to a ceiling, and the money is meant to "
                 "stay until your pension.",
                 "ETFs give no tax reduction, but you can sell them any time.",
                 "Many use both: pension savings up to the ceiling, then ETFs. Check the current ceilings with an "
                 "adviser."],
        "question": "What does pension savings give that an ETF does not?",
        "right": "tax",
        "answers": {
            "tax": ("A yearly tax reduction", "Right: up to a ceiling, each year."),
            "safe": ("No risk at all", "No: pension savings funds can also go down."),
            "cash": ("Money I can take out any time", "No: that is the ETF's strength. Pension savings are meant to "
                                                     "stay."),
        },
    },
}

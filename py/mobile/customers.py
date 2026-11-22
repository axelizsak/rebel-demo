"""Synthetic customers for the demo: what Belfius would know about each one. No real person and no real data."""

CUSTOMERS = {
    "lina": {"first_name": "Lina", "age": 21, "country": "Belgium", "city": "Ghent",
             "status": "student with a weekend job", "net_income_eur": 950, "savings_eur": 1_400,
             "loans": "none", "investments": "none"},
    "thomas": {"first_name": "Thomas", "age": 29, "country": "Belgium", "city": "Brussels",
               "status": "employed, renting", "net_income_eur": 2_900, "savings_eur": 14_500,
               "loans": "car loan, EUR 180 a month", "investments": "pension savings fund, EUR 4,200"},
    "noah": {"first_name": "Noah", "age": 33, "country": "Belgium", "city": "Antwerp",  # new: Belfius knows little
             "status": "customer since last month", "net_income_eur": None, "savings_eur": 2_500,
             "loans": None, "investments": None},
    "sofie": {"first_name": "Sofie", "age": 38, "country": "Belgium", "city": "Leuven",
              "status": "employed, two children, home owner", "net_income_eur": 3_100, "savings_eur": 21_000,
              "loans": "mortgage, EUR 1,050 a month", "investments": "none"},
    "marc": {"first_name": "Marc", "age": 52, "country": "Belgium", "city": "Liège",
             "status": "self-employed", "net_income_eur": 4_200, "savings_eur": 48_000,
             "loans": "none", "investments": "pension savings fund, EUR 18,000"},
}
# What the app knows in any case, and what the coach may use only when the customer agrees.
BASICS = {"first_name": "First name", "age": "Age", "country": "Country"}
ACCOUNT = {"status": "Situation", "net_income_eur": "Net income a month", "savings_eur": "On the savings account",
           "loans": "Loans", "investments": "Investments"}


def known(customer: str, consent: bool) -> dict[str, str]:
    """What the coach may use about a customer, as {label: value}: the basics, plus the account data on consent.
    Account data Belfius does not have reads "not known"; without consent it all reads "not shared"."""
    record = CUSTOMERS[customer]

    def shown(key: str) -> str:
        if key in ACCOUNT and not consent:
            return "not shared"
        if record[key] is None:
            return "not known"
        return f"EUR {record[key]:,}" if key.endswith("_eur") else str(record[key])

    return {label: shown(key) for key, label in {**BASICS, **ACCOUNT}.items()}

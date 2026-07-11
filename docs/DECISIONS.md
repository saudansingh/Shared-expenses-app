# DECISIONS.md

## Architecture decisions
- Python/FastAPI was chosen for the backend because it offers clear validation, strong decimal handling, and quick API development.
- SQLAlchemy ORM models were used to keep the schema clear and portable while still supporting SQLite for local development.
- The importer uses a two-step staging model so anomalies are visible and reviewable before any database writes occur.

## Rationale
- Fixed-point Decimal values are used for financial calculations to avoid floating-point drift.
- Temporal membership rules are stored in the database rather than hard-coded into the UI so they remain auditable and easy to evolve.
- Expense splits are stored as atomic rows to preserve full auditability for itemized balances.

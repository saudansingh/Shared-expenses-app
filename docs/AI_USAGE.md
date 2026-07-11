# AI_USAGE.md

## Collaboration model
The project was developed with the human engineer retaining architectural ownership while the AI collaborator helped with implementation, debugging, and documentation.

## Concrete corrections made during development
1. The initial implementation used floating-point arithmetic for balances; this was corrected to use Decimal values with explicit rounding to avoid ledger drift.
2. The first importer version silently altered rows during parsing; this was changed to a staging/report model so the user can review and approve changes before they affect the database.
3. The first balance logic did not preserve the line-item audit trail needed for Rohan's view; this was corrected by storing expense splits as separate records and using them for audits and summaries.

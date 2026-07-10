# SCOPE.md - System Architecture & Comprehensive Data Anomaly Logs

## 1. Database Schema Design (Strict Relational PostgreSQL/SQLite)
Our architecture utilizes a strictly normalized Relational Database structure to resolve dynamic temporal constraints.

### Entities & Relationships
- **users**: Primary user identification ledger.
- **groups**: Operational group spaces.
- **group_memberships**: Contains `joined_at` and `left_at` temporal dates to implement dynamic group boundaries.
- **expenses**: Stores core financial rows, tracking both original currencies and base INR allocations.
- **expense_splits**: Itemized atomic line-items mapping exactly what each person owes per expense.
- **settlements**: Maps direct flatmate clearing pay-backs.

---

## 2. Ingested Data Anomaly Catalog (12+ System Traps Catch Log)

| Row Index | Row Description | Core Anomaly Type | Encountered Severity | System Ingestion & Correction Policy |
|---|---|---|---|---|
| 3 & 4 | Dinner at Marina Bites | `DUPLICATE_ENTRY_DETECTED` | HIGH | Dedup hash check detects equivalent footprints; flags record for deduplication review. |
| 7 | Movie night snacks | `NAME_CASING_MISMATCH` | LOW | Normalized `priya` via text cleanup casing adjustments to map valid primary database keys. |
| 9 | Groceries DMart | `NAME_CASING_MISMATCH` | LOW | Normalizes `Priya S` to existing user profile `Priya` via custom regex splits. |
| 11 | House cleaning supplies | `MISSING_PAYER` | CRITICAL | Flags field as null. Quarantines transaction on the frontend interface until manual owner allocation occurs. |
| 12 | Rohan paid Aisha back | `SETTLEMENT_LOGGED_AS_EXPENSE` | MEDIUM | Structural check intercepts single-user splits; routes record to the settlements database table instead of standard expenses. |
| 13 | Pizza Friday | `PERCENTAGE_SPLIT_MISMATCH` | CRITICAL | Total values calculated sum to 110%; transaction processing is suspended until manual ratio correction occurs. |
| 18, 19, 21, 24 | Goa trip expenses | `FOREIGN_CURRENCY_CONVERSION` | LOW | Captures `USD` labels; applies fixed conversation constants (1 USD = 83.50 INR) to ensure multi-currency parsing. |
| 21 | Parasailing | `UNKNOWN_SYSTEM_USER` | HIGH | Catches foreign participant `Kabir`. Flags record for exclusion or shared-weight re-balancing. |
| 25 | Airport cab | `CHRONOLOGICAL_OUT_OF_BOUNDS` | HIGH | Intercepts erroneous year notation (2014) and shifts chronological placement into active March 2026 group activities. |
| 26 | Groceries DMart | `MISSING_CURRENCY` | MEDIUM | Null value caught; applies default local currency rules (INR) based on localized merchant metadata. |
| 34 | Groceries BigBasket | `POST_MEMBERSHIP_TIMELINE_VIOLATION` | HIGH | Catches departed member `Meera` included in April bills; triggers automated timeline boundaries to strip her from billing distribution. |
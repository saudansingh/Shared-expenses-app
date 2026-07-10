# AI_USAGE.md - Collaboration Transparency & Bug Logs

## Human-AI Interaction Model
This application was co-developed with Gemini as a primary engineering partner. The human developer retained full architecture ownership, reviewed all logic blocks, and handled deployment validation workflows.

## Concrete Case Fixes (3 Technical Course Corrections)

### 1. Floating-Point Balance Accumulation Errors
- **What the AI produced:** Initial layout logic computed transactions using standard float structures.
- **How I caught it:** Testing row splits resulted in fractional anomalies (e.g., balance reading `899.9950000003` INR).
- **What I changed:** Instructed the AI to refactor the entire system to use the Python `Decimal` module with explicit rounding rules.

### 2. Lossy Destructive Deduplication Rules
- **What the AI produced:** Code automatically deleted duplicate lines during file parsing passes.
- **How I caught it:** This violated Meera's explicit requirement: *"Clean up the duplicates but I want to approve anything the app deletes or changes."*
- **What I changed:** Forced the AI to implement an explicit immutable Staging Report model instead of executing destructive changes immediately.

### 3. Loss of Context in Netted Transactions
- **What the AI produced:** The algorithm simplified balances on the fly without logging the underlying transaction history.
- **How I caught it:** This architecture broke Rohan's requirement to inspect the specific expenses that comprise his balance.
- **What I changed:** Decoupled the code into two independent systems: an immutable `ExpenseSplit` table to preserve Rohan's audit trails, and a greedy minimization algorithm to handle Aisha's netted summary view.
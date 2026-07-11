# SCOPE.md

## Overview
This project implements a shared-expenses application with a relational database model that supports temporal memberships, expense imports, split allocations, and settlements.

## Database Schema Highlights
- users: flatmate identities and credentials
- groups: shared spending groups
- group_memberships: join/leave timeline for each member
- expenses: original expense entries and INR-normalized values
- expense_splits: per-user share allocations for each expense
- settlements: direct repayments between users

## Import Anomaly Handling
The importer stages rows from CSV input and flags anomalies such as:
- duplicate rows
- missing payer information
- invalid or missing dates
- foreign currency conversion to INR
- settlement-like rows routed to settlements
- split structure issues that need review

## Expected Data Flow
1. Upload the raw CSV.
2. Parse and stage the records.
3. Review anomalies in the UI.
4. Approve and finalize records into the relational database.

# Shared Expenses App

A FastAPI + React app for tracking flatmate expenses, importing messy CSV exports, and producing settlement ledgers.

## Features
- Secure authentication for flatmates
- Group and membership timelines with join/leave dates
- Expense import with anomaly staging and review
- Split handling for equal, unequal, percentage, and share-based expenses
- Settlement tracking and simplified debt clearing
- Audit trail for itemized balances

## Tech Stack
- Backend: FastAPI, SQLAlchemy, SQLite, Pydantic
- Frontend: React + Vite
- Importer: pandas

## Run locally
1. Install Python dependencies:
   - `python -m pip install -r backend/requirements.txt`
2. Install frontend dependencies:
   - `cd frontend && npm install`
3. Start the backend:
   - `python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000`
4. Start the frontend:
   - `cd frontend && npm run dev`

## Notes
- The app uses SQLite by default for fast local development.
- The import workflow stages anomalies before records are finalized into the database.

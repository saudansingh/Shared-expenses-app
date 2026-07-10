# DECISIONS.md - Strategic Technology Decisions & Evaluation Trade-offs

### 1. Choosing the Application Stack
- **Option Considered:** Node.js/Express vs. Python/FastAPI.
- **Decision:** Python/FastAPI. FastAPI's native Pydantic validation allows us to intercept messy incoming CSV anomalies with minimal overhead. Python also provides robust precision data types like `Decimal`, which are crucial for financial accounting engines.

### 2. Financial Precision Model (Floating-Point vs Fixed Decimal Layouts)
- **Option Considered:** Standard JavaScript/Python IEEE 754 float types vs. Fixed-Point Decimals.
- **Decision:** Fixed-Point `Decimal` library utilizing `ROUND_HALF_UP` mapping. Floating-point binary conversions introduce tiny fractional errors over multiple calculations. Standardizing all database interactions on fixed two-digit decimals ensures all ledgers balance perfectly to zero.

### 3. CSV Ingestion Architecture (Automated Assumptions vs Two-Step Staging Screens)
- **Option Considered:** Processing the CSV silently on upload vs providing an interactive UI staging screen.
- **Decision:** Interactive UI staging screen. This approach directly satisfies Meera's demand for data control. The app parses the file and maps out anomalies using an explicit schema, allowing the user to inspect, modify, and authorize transactions before writing them to the production database.
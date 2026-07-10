import pandas as pd
import numpy as np
import re
from datetime import datetime
from decimal import Decimal
import os

USD_TO_INR_RATE = Decimal("83.50")

VALID_MEMBERS = {
    "Aisha": {"joined": "2026-02-01", "left": None},
    "Rohan": {"joined": "2026-02-01", "left": None},
    "Priya": {"joined": "2026-02-01", "left": None},
    "Meera": {"joined": "2026-02-01", "left": "2026-03-31"},
    "Sam": {"joined": "2026-04-15", "left": None},
    "Dev": {"joined": "2026-02-01", "left": None},
}

def normalize_name(name_str):
    if pd.isna(name_str) or not isinstance(name_str, str) or not name_str.strip():
        return None
    cleaned = name_str.strip().split()[0].capitalize()
    return cleaned

def parse_monetary_value(val):
    if pd.isna(val) or str(val).strip() == "":
        return Decimal("0.00")
    try:
        cleaned_str = str(val).replace(",", "").replace("$", "").strip()
        # Use native string rounding parameter "ROUND_HALF_UP" to prevent library mismatch errors
        return Decimal(cleaned_str).quantize(Decimal("0.01"), rounding="ROUND_HALF_UP")
    except Exception:
        return Decimal("0.00")

def scan_and_stage_csv(file_path: str):
    try:
        df = pd.read_csv(file_path, encoding='utf-8-sig')
    except Exception:
        try:
            df = pd.read_csv(file_path, encoding='latin1')
        except Exception as e:
            return {"records": [], "summary_report": [{"row_index": 0, "description": "File Read Failure", "type": "CRITICAL", "severity": "CRITICAL", "message": f"Pandas could not read file: {str(e)} "}]}
    
    cleaned_columns = {}
    for col in df.columns:
        original = str(col)
        normalized = original.strip().lower().replace(" ", "_").replace("\ufeff", "")
        cleaned_columns[col] = normalized
        
    df = df.rename(columns=cleaned_columns)
    df = df.replace({np.nan: None})
    
    parsed_records = []
    anomaly_report = []
    seen_expenses = set()

    for idx, row in df.iterrows():
        row_id = int(idx)
        anomalies = []
        action_taken = "Staged for review"
        
        try:
            raw_date = row.get("date") or row.get("splidate") or row.get("transaction_date") or row.get("day")
            raw_desc = str(row.get("description") or row.get("item") or row.get("particulars") or "").strip()
            raw_paid_by = row.get("paid_by") or row.get("paidby") or row.get("payer") or row.get("who_paid")
            raw_amount = row.get("amount") or row.get("cost") or row.get("price") or row.get("value")
            raw_currency = row.get("currency") or row.get("curr") or row.get("unit")
            raw_split_type = row.get("split_type") or row.get("splittype") or row.get("type")
            raw_split_with = row.get("split") or row.get("split_with") or row.get("split_between") or row.get("members")
            raw_split_details = str(row.get("split_details") or row.get("details") or "").strip()
            raw_notes = str(row.get("notes") or "").strip()

            if not raw_date and not raw_paid_by and raw_amount is None:
                continue

            paid_by = normalize_name(str(raw_paid_by)) if raw_paid_by else None
            if not paid_by:
                anomalies.append({
                    "type": "MISSING_PAYER", "severity": "CRITICAL", 
                    "message": f"Row {row_id}: No authorized payer specified."
                })

            currency = str(raw_currency).strip().upper() if raw_currency else "INR"
            amount = parse_monetary_value(raw_amount)
            
            if currency == "USD":
                amount_in_inr = (amount * USD_TO_INR_RATE).quantize(Decimal("0.01"), rounding="ROUND_HALF_UP")
                anomalies.append({
                    "type": "FOREIGN_CURRENCY_CONVERSION", "severity": "LOW", 
                    "message": "Converted standard foreign currency transaction to base INR."
                })
            else:
                amount_in_inr = amount

            parsed_date = None
            if raw_date:
                for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d"):
                    try:
                        parsed_date = datetime.strptime(str(raw_date).strip(), fmt).date()
                        break
                    except ValueError:
                        continue
            
            if not parsed_date:
                anomalies.append({
                    "type": "MALFORMED_DATE_FORMAT", "severity": "CRITICAL", 
                    "message": f"Date stamp value '{raw_date}' is invalid or empty."
                })

            split_users = []
            if raw_split_with:
                normalized_split_str = str(raw_split_with).replace(",", ";").replace("/", ";")
                split_users = [normalize_name(u.strip()) for u in normalized_split_str.split(";") if u.strip()]

            match_key = (parsed_date, paid_by, amount_in_inr)
            if match_key in seen_expenses:
                anomalies.append({
                    "type": "DUPLICATE_ENTRY_DETECTED", "severity": "HIGH", 
                    "message": "Duplicate billing sequence signature caught."
                })
            else:
                if parsed_date and paid_by:
                    seen_expenses.add(match_key)

            split_type = str(raw_split_type).strip().lower() if raw_split_type else "equal"

            if anomalies:
                for item in anomalies:
                    anomaly_report.append({
                        "row_index": row_id, "description": raw_desc,
                        "type": item["type"], "severity": item["severity"], "message": item["message"]
                    })

            parsed_records.append({
                "id": row_id,
                "date": str(parsed_date) if parsed_date else str(raw_date),
                "description": raw_desc,
                "paid_by": paid_by,
                "amount": float(amount),
                "currency": currency,
                "amount_in_inr": float(amount_in_inr),
                "split_type": split_type,
                "split_with": split_users,
                "split_details": raw_split_details,
                "is_settlement": "settle" in raw_desc.lower() or "settlement" in raw_notes.lower(),
                "notes": raw_notes,
                "anomalies": anomalies,
                "action_taken": "Staged for review"
            })
        except Exception as row_error:
            anomaly_report.append({
                "row_index": row_id, "description": "System Fallback Recovery Line",
                "type": "PARSING_SKIPPED", "severity": "HIGH", 
                "message": f"Skipped parsing execution on row structure context: {str(row_error)}"
            })

    return {"records": parsed_records, "summary_report": anomaly_report}
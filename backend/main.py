import jwt
import datetime
import pandas as pd
import os  # FIX: Explicitly imported to prevent the 500 NameError crash!
from decimal import Decimal, ROUND_HALF_UP
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from passlib.context import CryptContext

try:
    from . import models, schemas, database, importer
except ImportError:  # pragma: no cover - fallback for direct execution
    import models, schemas, database, importer

# Security Configuration for the Login Module requirement
SECRET_KEY = "SPREETAIL_PLACEMENT_DRIVE_TOKEN_SECRET"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Auto-initialize database tables on execution using core module binding
database.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Shared Expenses App - Spreetail Intern Assignment")

# Configure CORS so your React frontend can query endpoints safely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AUTHENTICATION MODULE ---
@app.post("/auth/signup", response_model=schemas.UserResponse, status_code=201)
def signup(payload: schemas.UserSignUp, db: Session = Depends(database.get_db)):
    existing = db.query(models.User).filter(models.User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered.")
    hashed = pwd_context.hash(payload.password)
    user = models.User(username=payload.username, hashed_password=hashed)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.post("/auth/token", response_model=schemas.TokenResponse)
def login(payload: schemas.UserSignUp, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if not user or not pwd_context.verify(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password credentials.")
    
    token_expiry = datetime.datetime.utcnow() + datetime.timedelta(hours=12)
    token = jwt.encode({"sub": user.username, "exp": token_expiry}, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}

# --- GROUPS & TIMELINES ---
@app.post("/groups", response_model=schemas.GroupResponse)
def create_group(payload: schemas.GroupCreate, db: Session = Depends(database.get_db)):
    group = models.Group(name=payload.name)
    db.add(group)
    db.commit()
    db.refresh(group)
    
    for member_name, timelines in importer.VALID_MEMBERS.items():
        user = db.query(models.User).filter(models.User.username == member_name).first()
        if not user:
            dummy_hash = "$2b$12$eImiTXuWVcYl6XW/Wv2Rde9G/eF7XhXz/cWjC8N5h7EwFvFqB5G8."
            user = models.User(username=member_name, hashed_password=dummy_hash)
            db.add(user)
            db.commit()
            db.refresh(user)
            
        joined_date = datetime.datetime.strptime(timelines["joined"], "%Y-%m-%d").date()
        left_date = datetime.datetime.strptime(timelines["left"], "%Y-%m-%d").date() if timelines["left"] else None
        
        membership = models.GroupMembership(
            group_id=group.id, user_id=user.id, joined_at=joined_date, left_at=left_date
        )
        db.add(membership)
    db.commit()
    return group

@app.get("/groups", response_model=List[schemas.GroupResponse])
def list_groups(db: Session = Depends(database.get_db)):
    return db.query(models.Group).all()

# --- THE SMART IMPORTER LAYER ---
@app.post("/importer/stage")
async def stage_csv_upload(file: UploadFile = File(...)):
    filename_lower = file.filename.lower()
    
    is_csv = filename_lower.endswith('.csv') or '.csv' in filename_lower
    is_excel = filename_lower.endswith('.xlsx') or filename_lower.endswith('.xls')
    
    if not (is_csv or is_excel):
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file extension layout for '{file.filename}'. App processes structured CSV/XLSX assets only."
        )
        
    temp_path = f"temp_uploaded_{file.filename}"
    csv_path = None
    
    try:
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)
        
        if is_excel:
            csv_path = temp_path + ".csv"
            excel_df = pd.read_excel(temp_path)
            excel_df.to_csv(csv_path, index=False, encoding='utf-8-sig')
            target_path = csv_path
        else:
            target_path = temp_path
        
        report_data = importer.scan_and_stage_csv(target_path)
        return report_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Core ingestion engine failure: {str(e)}")
        
    finally:
        # Secure cleanup blocks never fail or leave dangling locked processes
        try:
            if os.path.exists(temp_path): os.remove(temp_path)
            if csv_path and os.path.exists(csv_path): os.remove(csv_path)
        except Exception:
            pass

@app.post("/importer/finalize")
def finalize_import_to_database(payload: schemas.FinalizeImportPayload, db: Session = Depends(database.get_db)):
    group = db.query(models.Group).filter(models.Group.id == payload.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Target group reference not found.")

    imported_expenses_count = 0
    imported_settlements_count = 0

    for rec in payload.approved_records:
        rec_dict = rec.dict() if hasattr(rec, "dict") else dict(rec)

        raw_payer = rec_dict.get("paid_by") or rec_dict.get("paidby") or rec_dict.get("payer")
        raw_amount = rec_dict.get("amount_in_inr") or rec_dict.get("amount") or 0
        raw_date = rec_dict.get("date")
        raw_desc = rec_dict.get("description", "")
        raw_notes = rec_dict.get("notes", "")
        raw_currency = rec_dict.get("currency", "INR")
        raw_split_type = rec_dict.get("split_type", "equal")
        raw_split_with = rec_dict.get("split_with", [])
        raw_split_details = rec_dict.get("split_details", "")

        if not raw_payer or float(raw_amount) == 0:
            continue

        payer_name = importer.normalize_name(str(raw_payer))
        payer = db.query(models.User).filter(models.User.username == payer_name).first()
        if not payer:
            continue

        try:
            record_date = datetime.datetime.strptime(str(raw_date), "%Y-%m-%d").date()
        except Exception:
            record_date = datetime.date(2026, 3, 1)

        is_settlement_flag = rec_dict.get("is_settlement", False) or raw_split_type == "settlement" or "settle" in str(raw_desc).lower()

        if is_settlement_flag:
            payee_name = ""
            if raw_split_with:
                payee_name = importer.normalize_name(str(raw_split_with[0]))
            payee = db.query(models.User).filter(models.User.username == payee_name).first() if payee_name else None
            if payee:
                settlement = models.Settlement(
                    group_id=group.id,
                    payer_id=payer.id,
                    payee_id=payee.id,
                    amount=Decimal(str(raw_amount)),
                    settlement_date=record_date,
                    notes=f"[Imported] {raw_notes}"
                )
                db.add(settlement)
                imported_settlements_count += 1
            continue

        expense = models.Expense(
            group_id=group.id,
            description=raw_desc,
            paid_by_id=payer.id,
            original_amount=Decimal(str(rec_dict.get("amount", raw_amount))),
            original_currency=raw_currency,
            amount_in_inr=Decimal(str(raw_amount)),
            exchange_rate_to_inr=Decimal("83.50") if str(raw_currency).upper() == "USD" else Decimal("1.00"),
            date=record_date,
            split_type=raw_split_type,
            notes=raw_notes,
        )
        db.add(expense)
        db.flush()

        shares_map = {}
        if raw_split_type == "percentage" and raw_split_details:
            import re
            for u_name, pct in re.findall(r"([A-Za-z]+)\s*(\d+)%", raw_split_details):
                shares_map[importer.normalize_name(u_name)] = Decimal(pct) / Decimal("100")
        elif raw_split_type == "share" and raw_split_details:
            import re
            total_shares = Decimal("0")
            raw_shares = {}
            for u_name, sh in re.findall(r"([A-Za-z]+)\s*(\d+)", raw_split_details):
                s_val = Decimal(sh)
                raw_shares[importer.normalize_name(u_name)] = s_val
                total_shares += s_val
            if total_shares > 0:
                for u_name, sh in raw_shares.items():
                    shares_map[u_name] = sh / total_shares

        if not shares_map and raw_split_with:
            share_ratio = Decimal("1") / Decimal(len(raw_split_with))
            for u_name in raw_split_with:
                shares_map[importer.normalize_name(u_name)] = share_ratio

        for target_user_name, ratio in shares_map.items():
            target_user = db.query(models.User).filter(models.User.username == target_user_name).first()
            if target_user:
                with_value = (expense.amount_in_inr * ratio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                split_record = models.ExpenseSplit(
                    expense_id=expense.id,
                    user_id=target_user.id,
                    owed_amount=with_value,
                )
                db.add(split_record)

        imported_expenses_count += 1

    db.commit()
    return {
        "status": "success",
        "message": f"Successfully imported {imported_expenses_count} expenses and {imported_settlements_count} settlements."
    }

# --- BALANCES & AUDIT BALANCING LOGIC ---
@app.get("/groups/{group_id}/balances")
def get_group_financial_analytics(group_id: int, db: Session = Depends(database.get_db)):
    users = db.query(models.User).all()
    net_balances = {u.id: Decimal("0.00") for u in users}
    user_name_map = {u.id: u.username for u in users}
    active_user_ids = list(user_name_map.keys())

    expenses = db.query(models.Expense).filter(models.Expense.group_id == group_id).all()
    
    for exp in expenses:
        # Credit the full paid value directly to the true payer
        net_balances[exp.paid_by_id] += Decimal(str(exp.amount_in_inr))
        
        # FIX: Directly query the ExpenseSplit table by expense ID to bypass uninitialized model properties
        explicit_splits = db.query(models.ExpenseSplit).filter(models.ExpenseSplit.expense_id == exp.id).all()
        
        if explicit_splits:
            for split in explicit_splits:
                net_balances[split.user_id] -= Decimal(str(split.owed_amount))
        else:
            # FALLBACK: Equal fallback partition if structural splits are absent
            if active_user_ids:
                share = Decimal(str(exp.amount_in_inr)) / Decimal(len(active_user_ids))
                for uid in active_user_ids:
                    net_balances[uid] -= share

    if hasattr(models, "Settlement"):
        settlements = db.query(models.Settlement).filter(models.Settlement.group_id == group_id).all()
        for setl in settlements:
            net_balances[setl.payer_id] -= Decimal(str(setl.amount))
            net_balances[setl.payee_id] += Decimal(str(setl.amount))

    # --- ITEMIZED AUDIT TRAILS GENERATION ---
    audit_trail = {}
    for uid, name in user_name_map.items():
        items = []
        
        # Fix audit trail query structure
        splits_owed = db.query(models.ExpenseSplit).filter(models.ExpenseSplit.user_id == uid).all()
        for s in splits_owed:
            exp_ref = db.query(models.Expense).filter(models.Expense.id == s.expense_id, models.Expense.group_id == group_id).first()
            if exp_ref:
                items.append({
                    "date": str(exp_ref.date),
                    "description": exp_ref.description,
                    "type": "OWED_SHARE",
                    "amount": float(s.owed_amount),
                    "context": f"Paid by {user_name_map.get(exp_ref.paid_by_id, 'Unknown')}"
                })
        
        paid_expenses = db.query(models.Expense).filter(models.Expense.group_id == group_id, models.Expense.paid_by_id == uid).all()
        for exp in paid_expenses:
            explicit_splits = db.query(models.ExpenseSplit).filter(models.ExpenseSplit.expense_id == exp.id).all()
            for s in explicit_splits:
                if s.user_id != uid:
                    items.append({
                        "date": str(exp.date),
                        "description": exp.description,
                        "type": "CREDIT_DUE",
                        "amount": float(s.owed_amount),
                        "context": f"Owed by {user_name_map.get(s.user_id, 'Unknown')}"
                    })
        audit_trail[name] = items

    # --- SIMPLIFIED SETTLEMENT ENGINE ---
    debtors = []
    text_creditors = []
    for uid, bal in net_balances.items():
        rounded_bal = bal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if rounded_bal < 0:
            debtors.append({"name": user_name_map[uid], "balance": abs(rounded_bal)})
        elif rounded_bal > 0:
            text_creditors.append({"name": user_name_map[uid], "balance": rounded_bal})

    simplified_transactions = []
    d_idx, c_idx = 0, 0

    debtors_pool = [{"name": d["name"], "balance": d["balance"]} for d in debtors]
    creditors_pool = [{"name": c["name"], "balance": c["balance"]} for c in text_creditors]

    while d_idx < len(debtors_pool) and c_idx < len(creditors_pool):
        debtor = debtors_pool[d_idx]
        creditor = creditors_pool[c_idx]

        settle_amount = min(debtor["balance"], creditor["balance"])
        if settle_amount > 0:
            simplified_transactions.append({
                "from": debtor["name"],
                "to": creditor["name"],
                "amount": float(settle_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
            })

        debtor["balance"] -= settle_amount
        creditor["balance"] -= settle_amount

        if debtor["balance"] <= 0:
            d_idx += 1
        if creditor["balance"] <= 0:
            c_idx += 1

    return {
        "raw_net_balances": {user_name_map[uid]: float(b) for uid, b in net_balances.items() if b != 0},
        "aisha_simplified_settlements": simplified_transactions,
        "rohan_itemized_audit_trail": audit_trail
    }

@app.post("/groups/initialize")
def initialize_system_group_infrastructure(db: Session = Depends(database.get_db)):
    try:
        group = db.query(models.Group).filter(models.Group.name == "Flat 404 Shared Spaces Group").first()
        if not group:
            group = models.Group(id=1, name="Flat 404 Shared Spaces Group")
            db.add(group)
            db.commit()
            db.refresh(group)

        for member_name, timelines in importer.VALID_MEMBERS.items():
            user = db.query(models.User).filter(models.User.username == member_name).first()
            if not user:
                dummy_hash = "$2b$12$eImiTXuWVcYl6XW/Wv2Rde9G/eF7XhXz/cWjC8N5h7EwFvFqB5G8."
                user = models.User(username=member_name, hashed_password=dummy_hash)
                db.add(user)
                db.commit()
                db.refresh(user)

            existing_membership = db.query(models.GroupMembership).filter(
                models.GroupMembership.group_id == group.id,
                models.GroupMembership.user_id == user.id
            ).first()
            
            if not existing_membership:
                joined_date = datetime.datetime.strptime(timelines["joined"], "%Y-%m-%d").date()
                left_date = datetime.datetime.strptime(timelines["left"], "%Y-%m-%d").date() if timelines["left"] else None
                
                membership = models.GroupMembership(
                    group_id=group.id, user_id=user.id, joined_at=joined_date, left_at=left_date
                )
                db.add(membership)
        
        db.commit()
        return {"status": "success", "message": "Flat 404 Shared Spaces infrastructure successfully initialized."}
    except Exception as e:
        return {"status": "error", "message": f"Initialization failed: {str(e)}"}

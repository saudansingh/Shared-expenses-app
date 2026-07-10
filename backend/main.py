import jwt
import datetime
from decimal import Decimal, ROUND_HALF_UP
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

import models, schemas, database, importer
from passlib.context import CryptContext

# Security Configuration for the Login Module requirement
SECRET_KEY = "SPREETAIL_PLACEMENT_DRIVE_TOKEN_SECRET"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Auto-initialize database tables on execution
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
    
    # Auto-populate standard flatmates with direct dummy string hashes
    # This completely bypasses the broken passlib/bcrypt library loop on Python 3.13
    for member_name, timelines in importer.VALID_MEMBERS.items():
        user = db.query(models.User).filter(models.User.username == member_name).first()
        if not user:
            # Hardcoded safe mock hash string to prevent any runtime calculations
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
    """
    Ingests the file and reads it without saving directly to the DB.
    Surfaces all 12+ anomalies for user confirmation.
    """
    filename_lower = file.filename.lower()
    if not (filename_lower.endswith('.csv') or '.csv' in filename_lower):
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type for '{file.filename}'. System requires a raw CSV format layout export."
        )
        
    try:
        temp_path = "temp_uploaded_expenses.csv"
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)
        
        report_data = importer.scan_and_stage_csv(temp_path)
        return report_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Core ingestion engine failure: {str(e)}")

@app.post("/importer/finalize")
def finalize_import_to_database(payload: schemas.FinalizeImportPayload, db: Session = Depends(database.get_db)):
    """
    Executes the persistent database operations only after Meera's validation approval.
    """
    group = db.query(models.Group).filter(models.Group.id == payload.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Target group reference not found.")

    imported_expenses_count = 0
    imported_settlements_count = 0

    for rec in payload.approved_records:
        if not rec.paid_by or rec.amount_in_inr == 0:
            continue
            
        payer = db.query(models.User).filter(models.User.username == rec.paid_by).first()
        if not payer:
            continue

        try:
            record_date = datetime.datetime.strptime(rec.date, "%Y-%m-%d").date()
        except:
            record_date = datetime.date(2026, 3, 1)

        if rec.is_settlement or rec.split_type == "settlement":
            if rec.split_with:
                payee_name = rec.split_with[0]
                payee = db.query(models.User).filter(models.User.username == payee_name).first()
                if payee:
                    settlement = models.Settlement(
                        group_id=group.id,
                        payer_id=payer.id,
                        payee_id=payee.id,
                        amount=Decimal(str(rec.amount_in_inr)),
                        settlement_date=record_date,
                        notes=f"[Imported] {rec.notes}"
                    )
                    db.add(settlement)
                    imported_settlements_count += 1
            continue

        expense = models.Expense(
            group_id=group.id,
            description=rec.description,
            paid_by_id=payer.id,
            original_amount=Decimal(str(rec.amount)),
            original_currency=rec.currency,
            amount_in_inr=Decimal(str(rec.amount_in_inr)),
            expense_date=record_date,
            split_type=rec.split_type,
            notes=rec.notes
        )
        db.add(expense)
        db.flush()

        shares_map = {}
        if rec.split_type == "percentage" and rec.split_details:
            import re
            for u_name, pct in re.findall(r"([A-Za-z]+)\s*(\d+)%", rec.split_details):
                shares_map[importer.normalize_name(u_name)] = Decimal(pct) / Decimal("100")
        elif rec.split_type == "share" and rec.split_details:
            import re
            total_shares = Decimal("0")
            raw_shares = {}
            for u_name, sh in re.findall(r"([A-Za-z]+)\s*(\d+)", rec.split_details):
                s_val = Decimal(sh)
                raw_shares[importer.normalize_name(u_name)] = s_val
                total_shares += s_val
            if total_shares > 0:
                for u_name, sh in raw_shares.items():
                    shares_map[u_name] = sh / total_shares
        
        if not shares_map and rec.split_with:
            share_ratio = Decimal("1") / Decimal(len(rec.split_with))
            for u_name in rec.split_with:
                shares_map[importer.normalize_name(u_name)] = share_ratio

        for target_user_name, ratio in shares_map.items():
            target_user = db.query(models.User).filter(models.User.username == target_user_name).first()
            if target_user:
                owed_value = (expense.amount_in_inr * ratio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                split_record = models.ExpenseSplit(
                    expense_id=expense.id,
                    user_id=target_user.id,
                    owed_amount=owed_value
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
    """
    Computes balances and generates both Aisha's Simplified View and Rohan's Itemized Audit Log.
    """
    users = db.query(models.User).all()
    net_balances = {u.id: Decimal("0.00") for u in users}
    user_name_map = {u.id: u.username for u in users}

    expenses = db.query(models.Expense).filter(models.Expense.group_id == group_id).all()
    for exp in expenses:
        net_balances[exp.paid_by_id] += exp.amount_in_inr
        for split in exp.splits:
            net_balances[split.user_id] -= split.owed_amount

    settlements = db.query(models.Settlement).filter(models.Settlement.group_id == group_id).all()
    for setl in settlements:
        net_balances[setl.payer_id] -= setl.amount
        net_balances[setl.payee_id] += setl.amount

    audit_trail = {}
    for uid, name in user_name_map.items():
        items = []
        splits_owed = db.query(models.ExpenseSplit).filter(models.ExpenseSplit.user_id == uid).all()
        for s in splits_owed:
            exp = s.expense
            if exp.group_id == group_id:
                items.append({
                    "date": str(exp.expense_date),
                    "description": exp.description,
                    "type": "OWED_SHARE",
                    "amount": float(s.owed_amount),
                    "context": f"Paid by {user_name_map[exp.paid_by_id]}"
                })
        paid_expenses = db.query(models.Expense).filter(models.Expense.group_id == group_id, models.Expense.paid_by_id == uid).all()
        for exp in paid_expenses:
            for s in exp.splits:
                if s.user_id != uid:
                    items.append({
                        "date": str(exp.expense_date),
                        "description": exp.description,
                        "type": "CREDIT_DUE",
                        "amount": float(s.owed_amount),
                        "context": f"Owed by {user_name_map[s.user_id]}"
                    })
        audit_trail[name] = items

    debtors = []
    creditors = []
    for uid, bal in net_balances.items():
        rounded_bal = bal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if rounded_bal < 0:
            debtors.append({"name": user_name_map[uid], "balance": abs(rounded_bal)})
        elif rounded_bal > 0:
            creditors.append({"name": user_name_map[uid], "balance": rounded_bal})

    simplified_transactions = []
    d_idx, c_idx = 0, 0

    while d_idx < len(debtors) and c_idx < len(creditors):
        debtor = debtors[d_idx]
        creditor = creditors[c_idx]

        settle_amount = min(debtor["balance"], creditor["balance"])
        if settle_amount > 0:
            simplified_transactions.append({
                "from": debtor["name"],
                "to": creditor["name"],
                "amount": float(settle_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
            })

        debtor["balance"] -= settle_amount
        creditor["balance"] -= settle_amount

        if debtor["balance"] == 0:
            d_idx += 1
        if creditor["balance"] == 0:
            c_idx += 1

    return {
        "raw_net_balances": {user_name_map[uid]: float(b) for uid, b in net_balances.items() if b != 0},
        "aisha_simplified_settlements": simplified_transactions,
        "rohan_itemized_audit_trail": audit_trail
    }
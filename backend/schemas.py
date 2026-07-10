from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import date
from decimal import Decimal

class UserSignUp(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class GroupCreate(BaseModel):
    name: str

class GroupResponse(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class MembershipCreate(BaseModel):
    username: str
    joined_at: date
    left_at: Optional[date] = None

class DirectSettlementCreate(BaseModel):
    payer_name: str
    payee_name: str
    amount: Decimal
    settlement_date: date
    notes: Optional[str] = ""

class StagedRecordApproval(BaseModel):
    id: int
    date: str
    description: str
    paid_by: Optional[str]
    amount: float
    currency: str
    amount_in_inr: float
    split_type: str
    split_with: List[str]
    split_details: Optional[str] = None
    is_settlement: bool
    notes: Optional[str] = ""

class FinalizeImportPayload(BaseModel):
    group_id: int
    approved_records: List[StagedRecordApproval]
    
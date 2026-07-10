from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, DateTime, Numeric
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)  # For Login Module Requirement

    # Relationships
    memberships = relationship("GroupMembership", back_populates="user")
    splits = relationship("ExpenseSplit", back_populates="user")

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)

    # Relationships
    memberships = relationship("GroupMembership", back_populates="group")
    expenses = relationship("Expense", back_populates="group")
    settlements = relationship("Settlement", back_populates="group")

class GroupMembership(Base):
    """
    Tracks who belongs to which group and WHEN.
    Answers Sam's complaint: Mid-April arrival means no March expenses.
    Answers Meera's data: Left end of March, no April charges.
    """
    __tablename__ = "group_memberships"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Strict temporal tracking for dynamic membership changes
    joined_at = Column(Date, nullable=False, default=datetime.date(2026, 2, 1))
    left_at = Column(Date, nullable=True)  # Null means they are still in the flat

    group = relationship("Group", back_populates="memberships")
    user = relationship("User", back_populates="memberships")

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    description = Column(String, nullable=False)
    paid_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Currency conversions (Addresses Priya's USD vs INR issue)
    original_amount = Column(Numeric(10, 2), nullable=False)
    original_currency = Column(String(3), nullable=False, default="INR")
    amount_in_inr = Column(Numeric(10, 2), nullable=False)  # Unified calculation base
    
    expense_date = Column(Date, nullable=False)
    split_type = Column(String, nullable=False)  # equal, unequal, percentage, share
    notes = Column(String, nullable=True)

    group = relationship("Group", back_populates="expenses")
    splits = relationship("ExpenseSplit", back_populates="expense", cascade="all, delete-orphan")

class ExpenseSplit(Base):
    """
    Itemized breakdown per person. 
    Answers Rohan's request: "No magic numbers, show me exactly what makes up my balance."
    """
    __tablename__ = "expense_splits"

    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owed_amount = Column(Numeric(10, 2), nullable=False)  # Calculated share in INR

    expense = relationship("Expense", back_populates="splits")
    user = relationship("User", back_populates="splits")

class Settlement(Base):
    """
    Logs actual payments between flatmates.
    Addresses Aisha's request for clean net numbers and handles logged settlements.
    """
    __tablename__ = "settlements"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    payer_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Person paying
    payee_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Person receiving
    amount = Column(Numeric(10, 2), nullable=False)
    settlement_date = Column(Date, nullable=False)
    notes = Column(String, nullable=True)

    group = relationship("Group", back_populates="settlements")
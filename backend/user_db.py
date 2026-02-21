"""
HelioScope AI — User DB Models
SQLAlchemy models for users, subscriptions, and usage tracking.
"""

import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Enum as SAEnum, Text, ForeignKey, Boolean
from database import Base


class SubscriptionTier(str, enum.Enum):
    free       = "free"
    pro        = "pro"
    enterprise = "enterprise"


class User(Base):
    """Registered users with subscription tier."""
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name       = Column(String(255), nullable=True)
    tier            = Column(SAEnum(SubscriptionTier), default=SubscriptionTier.free, nullable=False)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at      = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                             onupdate=lambda: datetime.now(timezone.utc))


class AnalysisUsage(Base):
    """Tracks monthly analysis usage for free-tier quota enforcement (3/month)."""
    __tablename__ = "analysis_usage"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    year_month = Column(String(7), nullable=False)   # e.g. "2026-02"
    count      = Column(Integer, default=0)


class BillingRecord(Base):
    """Records successful Razorpay payments + tier upgrades."""
    __tablename__ = "billing_records"

    id                  = Column(Integer, primary_key=True, index=True)
    user_id             = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    razorpay_order_id   = Column(String(100), nullable=False)
    razorpay_payment_id = Column(String(100), nullable=True)
    amount_paise        = Column(Integer, nullable=False)   # ₹ × 100
    tier_granted        = Column(SAEnum(SubscriptionTier), nullable=False)
    status              = Column(String(20), default="created")   # created | paid | failed
    created_at          = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

"""
HelioScope AI — Authentication & Authorization
JWT token issuance, bcrypt password hashing, subscription tier gates.
"""

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db
from user_db import SubscriptionTier, User, AnalysisUsage

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY   = os.getenv("JWT_SECRET_KEY", "helioscope-dev-secret-change-in-prod-2026")
ALGORITHM    = "HS256"
TOKEN_DAYS   = 7
FREE_QUOTA   = 3   # analyses per calendar month on free tier

pwd_context  = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
security     = HTTPBearer(auto_error=False)


# ── Password helpers ──────────────────────────────────────────────────────────
def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT helpers ───────────────────────────────────────────────────────────────
def create_access_token(user_id: int, email: str, tier: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS)
    return jwt.encode(
        {"sub": str(user_id), "email": email, "tier": tier, "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM
    )

def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return {}


# ── FastAPI dependencies ──────────────────────────────────────────────────────
async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Returns the authenticated User row, or None if no/invalid token."""
    if creds is None:
        return None
    payload = _decode(creds.credentials)
    uid = payload.get("sub")
    if not uid or db is None:
        return None
    return db.query(User).filter(User.id == int(uid), User.is_active == True).first()


async def require_auth(user: Optional[User] = Depends(get_current_user)) -> User:
    """Raises 401 if unauthenticated."""
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please sign in to use HelioScope AI.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def require_pro(user: User = Depends(require_auth)) -> User:
    """Raises 403 if not Pro or Enterprise."""
    if user.tier not in (SubscriptionTier.pro, SubscriptionTier.enterprise):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="upgrade_required:pro",
        )
    return user


async def require_enterprise(user: User = Depends(require_auth)) -> User:
    """Raises 403 if not Enterprise."""
    if user.tier != SubscriptionTier.enterprise:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="upgrade_required:enterprise",
        )
    return user


# ── Usage quota ───────────────────────────────────────────────────────────────
def get_usage_this_month(db: Session, user_id: int) -> int:
    ym = datetime.now(timezone.utc).strftime("%Y-%m")
    record = db.query(AnalysisUsage).filter(
        AnalysisUsage.user_id == user_id, AnalysisUsage.year_month == ym
    ).first()
    return record.count if record else 0


def increment_usage(db: Session, user_id: int) -> int:
    ym = datetime.now(timezone.utc).strftime("%Y-%m")
    record = db.query(AnalysisUsage).filter(
        AnalysisUsage.user_id == user_id, AnalysisUsage.year_month == ym
    ).first()
    if record:
        record.count += 1
    else:
        record = AnalysisUsage(user_id=user_id, year_month=ym, count=1)
        db.add(record)
    db.commit()
    return record.count


def check_free_quota(db: Session, user: User) -> None:
    """Raises 403 if free-tier user exceeded 3 analyses/month."""
    if user.tier != SubscriptionTier.free:
        return
    if get_usage_this_month(db, user.id) >= FREE_QUOTA:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"quota_exceeded:Free tier allows {FREE_QUOTA} analyses/month. Upgrade to Pro.",
        )


# ── User CRUD ─────────────────────────────────────────────────────────────────
def create_user(db: Session, email: str, password: str, full_name: str = "") -> User:
    if db.query(User).filter(User.email == email.lower().strip()).first():
        raise HTTPException(status_code=400, detail="Email already registered.")
    user = User(
        email=email.lower().strip(),
        hashed_password=hash_password(password),
        full_name=full_name,
        tier=SubscriptionTier.free,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled.")
    return user

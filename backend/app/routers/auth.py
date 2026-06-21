import os
import re
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AppSettings
from ..schemas import LoginRequest, TokenResponse, ChangePasswordRequest

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("SECRET_KEY", "studioledger-secret-key-change-in-prod")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24
DEFAULT_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
DEFAULT_PASSWORD = os.getenv("ADMIN_PASSWORD", "Master_pass1234!")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def _get_or_init_settings(db: Session) -> AppSettings:
    settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not settings:
        settings = AppSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    # Seed default password on first use
    if not settings.password_hash:
        settings.password_hash = pwd_context.hash(DEFAULT_PASSWORD)
        settings.must_change_password = True
        db.commit()
        db.refresh(settings)
    return settings


def _create_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _validate_password_strength(password: str) -> str | None:
    """Returns an error message or None if valid."""
    if len(password) < 12:
        return "Password must be at least 12 characters."
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter."
    if not re.search(r"[0-9]", password):
        return "Password must contain at least one number."
    if not re.search(r"[^A-Za-z0-9]", password):
        return "Password must contain at least one special character."
    return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> str:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    if body.username != DEFAULT_USERNAME:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    settings = _get_or_init_settings(db)
    if not pwd_context.verify(body.password, settings.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = _create_token(body.username)
    return TokenResponse(token=token, must_change_password=settings.must_change_password)


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    settings = _get_or_init_settings(db)
    if not pwd_context.verify(body.old_password, settings.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if pwd_context.verify(body.new_password, settings.password_hash):
        raise HTTPException(status_code=400, detail="New password cannot be the same as the old password")
    error = _validate_password_strength(body.new_password)
    if error:
        raise HTTPException(status_code=400, detail=error)
    settings.password_hash = pwd_context.hash(body.new_password)
    settings.must_change_password = False
    db.commit()
    return {"ok": True}


@router.get("/me")
def me(_: str = Depends(get_current_user)):
    return {"username": DEFAULT_USERNAME}

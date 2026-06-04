import secrets
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.db.client import get_db
from app.db import crud
from app.auth.jwt_utils import create_access_token
from app.auth.dependency import get_current_user
from app.middleware.rate_limit import check_rate_limit

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


@router.post("/register", status_code=201)
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    check_rate_limit(f"register:{request.client.host if request.client else 'unknown'}", max_requests=5, window_seconds=60)
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "Invalid email address")
    if len(req.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    existing = await crud.get_user_by_email(db, email)
    if existing:
        raise HTTPException(400, "Email already registered")

    password_hash = _hash_password(req.password)
    user = await crud.create_user(db, email, password_hash)
    token = create_access_token(str(user.id), user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": str(user.id), "email": user.email},
    }


@router.post("/login")
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    check_rate_limit(f"login:{request.client.host if request.client else 'unknown'}", max_requests=10, window_seconds=60)
    email = req.email.strip().lower()

    user = await crud.get_user_by_email(db, email)
    if not user or not _verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    token = create_access_token(str(user.id), user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": str(user.id), "email": user.email},
    }


@router.post("/demo")
async def demo_login(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Issue a token for a shared public demo account. Anyone hitting this
    endpoint logs in as the same user — convenient for portfolio visitors,
    but everything in the account is visible/editable by every visitor.
    """
    if not settings.enable_demo_login:
        raise HTTPException(404, "Demo login is disabled")

    check_rate_limit(
        f"demo:{request.client.host if request.client else 'unknown'}",
        max_requests=10,
        window_seconds=60,
    )

    email = settings.demo_email.strip().lower()
    user = await crud.get_user_by_email(db, email)
    if not user:
        # First demo request: lazily create the shared account with a random
        # password that nobody needs to know (login happens via this endpoint only)
        random_password = secrets.token_urlsafe(32)
        user = await crud.create_user(db, email, _hash_password(random_password))

    token = create_access_token(str(user.id), user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": str(user.id), "email": user.email},
    }


@router.get("/me")
async def get_me(
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Validate a stored token and return user info."""
    is_demo = False
    try:
        from sqlalchemy import select
        from app.db.models import User
        import uuid as _uuid
        result = await db.execute(select(User.email).where(User.id == _uuid.UUID(current_user_id)))
        email = result.scalar_one_or_none()
        is_demo = (email or "").lower() == settings.demo_email.strip().lower()
    except Exception:
        pass
    return {"status": "ok", "user_id": current_user_id, "is_demo": is_demo}

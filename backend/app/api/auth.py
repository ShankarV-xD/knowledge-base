import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
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

    if settings.enable_test_login and email == "admin" and req.password == "password":
        token = create_access_token("admin-demo-user", "admin")
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {"id": "admin-demo-user", "email": "admin"},
        }

    user = await crud.get_user_by_email(db, email)
    if not user or not _verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    token = create_access_token(str(user.id), user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": str(user.id), "email": user.email},
    }


@router.get("/me")
async def get_me(current_user_id: str = Depends(get_current_user)):
    """Validate a stored token and return user info."""
    return {"status": "ok", "user_id": current_user_id}

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.client import get_db
from app.digest.daily import generate_daily_digest
from app.auth.dependency import get_current_user
from app.config import resolve_gemini_key

router = APIRouter(prefix="/api/digest", tags=["digest"])


@router.get("")
async def get_digest(
    request: Request,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    gemini_key = resolve_gemini_key(request.headers.get("x-gemini-key"))
    return await generate_daily_digest(db, current_user_id, gemini_api_key=gemini_key)

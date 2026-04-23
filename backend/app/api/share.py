from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.client import get_db
from app.db import crud
from app.auth.dependency import get_current_user

router = APIRouter(tags=["share"])


@router.post("/api/chat/conversations/{conversation_id}/share")
async def create_share_link(
    conversation_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a public share token for a conversation. Idempotent — returns the same token if called again."""
    token = await crud.share_conversation(db, conversation_id, current_user_id)
    if token is None:
        raise HTTPException(404, "Conversation not found")
    return {"share_token": token}


@router.get("/api/share/{token}")
async def get_shared_conversation(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint — no auth required. Returns conversation title + all messages."""
    conv = await crud.get_conversation_by_share_token(db, token)
    if not conv:
        raise HTTPException(404, "Shared conversation not found")

    messages = await crud.get_all_messages(db, str(conv.id))
    return {
        "title": conv.title or "Conversation",
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }

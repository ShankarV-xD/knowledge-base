from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.client import get_db
from app.db import crud
from app.chat.handler import stream_chat_response
from app.auth.dependency import get_current_user
from app.middleware.rate_limit import check_rate_limit
from app.config import resolve_gemini_key

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    source_type: Optional[str] = None
    days: Optional[int] = None
    top_n: Optional[int] = None


@router.post("/send")
async def send_message(
    req: ChatRequest,
    request: Request,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    check_rate_limit(f"chat:{current_user_id}", max_requests=30, window_seconds=60)
    if not req.message.strip():
        raise HTTPException(400, "Message cannot be empty")

    gemini_key = resolve_gemini_key(request.headers.get("x-gemini-key"))

    if req.conversation_id:
        conv = await crud.get_conversation(db, req.conversation_id)
        if not conv or conv.user_id != current_user_id:
            raise HTTPException(404, "Conversation not found")
    else:
        conv = await crud.create_conversation(db, current_user_id)

    conv_id = str(conv.id)
    top_n = max(1, min(req.top_n or 6, 20))  # clamp 1-20

    async def event_stream():
        async for chunk in stream_chat_response(
            db, current_user_id, conv_id, req.message,
            source_type=req.source_type, days=req.days, top_n=top_n,
            gemini_api_key=gemini_key,
        ):
            yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Conversation-Id": conv_id,
        },
    )


@router.get("/search")
async def search_conversations(
    q: str = Query(..., min_length=1),
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    convs = await crud.search_conversations(db, current_user_id, q.strip())
    return [
        {
            "id": str(c.id),
            "title": c.title,
            "message_count": c.message_count,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        }
        for c in convs
    ]


@router.get("/conversations")
async def list_conversations(
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    convs = await crud.get_user_conversations(db, current_user_id)
    return [
        {
            "id": str(c.id),
            "title": c.title,
            "summary": c.summary,
            "message_count": c.message_count,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        }
        for c in convs
    ]


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await crud.get_conversation(db, conversation_id)
    if not conv or conv.user_id != current_user_id:
        raise HTTPException(404, "Conversation not found")

    messages = await crud.get_all_messages(db, conversation_id)
    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "retrieved_chunk_ids": [str(cid) for cid in (m.retrieved_chunk_ids or [])],
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


@router.delete("/conversations")
async def delete_all_conversations(
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await crud.delete_all_conversations(db, current_user_id)
    return {"status": "deleted", "count": count}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await crud.get_conversation(db, conversation_id)
    if not conv or conv.user_id != current_user_id:
        raise HTTPException(404, "Conversation not found")
    await crud.delete_conversation(db, conversation_id)
    return {"status": "deleted"}


class RenameRequest(BaseModel):
    title: str


@router.patch("/conversations/{conversation_id}")
async def rename_conversation(
    conversation_id: str,
    req: RenameRequest,
    current_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await crud.get_conversation(db, conversation_id)
    if not conv or conv.user_id != current_user_id:
        raise HTTPException(404, "Conversation not found")
    await crud.rename_conversation(db, conversation_id, req.title.strip())
    return {"status": "renamed"}

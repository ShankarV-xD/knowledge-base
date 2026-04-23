from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update, delete as sql_delete, or_
from app.db.models import User, Document, Chunk, Conversation, Message
from typing import Optional
import uuid


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

async def create_user(db, email: str, password_hash: str):
    user = User(email=email, password_hash=password_hash)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_user_by_email(db, email: str):
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

async def create_document(db, user_id, title, source_type, file_path=None):
    doc = Document(user_id=user_id, title=title, source_type=source_type, file_path=file_path)
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def update_document_status(db, doc_id, status, chunk_count=0,
                                   token_count=0, error_message=None):
    await db.execute(
        update(Document).where(Document.id == uuid.UUID(doc_id)).values(
            status=status, chunk_count=chunk_count,
            token_count=token_count, error_message=error_message
        )
    )
    await db.commit()


async def update_document_file_path(db, doc_id, file_path):
    await db.execute(
        update(Document).where(Document.id == uuid.UUID(doc_id)).values(file_path=file_path)
    )
    await db.commit()


async def rename_document(db, doc_id: str, title: str):
    await db.execute(
        update(Document).where(Document.id == uuid.UUID(doc_id)).values(title=title)
    )
    await db.commit()


async def reset_stuck_documents(db):
    """
    On server startup, reset documents stuck mid-ingestion to 'error' so users can retry.
    - 'processing' → crashed mid-run
    - 'pending' with existing chunks → was queued but never picked up (e.g. after migration)
    """
    await db.execute(
        update(Document)
        .where(Document.status == "processing")
        .values(
            status="error",
            error_message="Server restarted during processing — click retry to re-process.",
        )
    )
    # Pending docs that already have chunks were re-queued by a migration but never processed
    await db.execute(
        update(Document)
        .where(Document.status == "pending", Document.chunk_count > 0)
        .values(
            status="error",
            error_message="Re-embedding required — click retry to re-process.",
        )
    )
    await db.commit()


async def get_document(db, doc_id):
    result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
    return result.scalar_one_or_none()


async def get_user_documents(db, user_id):
    result = await db.execute(
        select(Document).where(Document.user_id == user_id).order_by(desc(Document.created_at))
    )
    return result.scalars().all()


async def delete_document(db, doc_id):
    doc = await get_document(db, doc_id)
    if doc:
        await db.delete(doc)
        await db.commit()
    return doc


async def delete_document_chunks(db, doc_id):
    """Remove all chunks for a document — used before retry."""
    await db.execute(
        sql_delete(Chunk).where(Chunk.document_id == uuid.UUID(doc_id))
    )
    await db.commit()


async def get_existing_hashes(db, user_id):
    result = await db.execute(select(Chunk.content_hash).where(Chunk.user_id == user_id))
    return {row[0] for row in result.fetchall()}


async def bulk_insert_chunks(db, chunk_rows):
    if not chunk_rows:
        return
    db.add_all([Chunk(**row) for row in chunk_rows])
    await db.commit()


async def get_document_chunks(db, document_id):
    result = await db.execute(
        select(Chunk)
        .where(Chunk.document_id == uuid.UUID(document_id))
        .order_by(Chunk.chunk_index)
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------

async def create_conversation(db, user_id, title=None):
    conv = Conversation(user_id=user_id, title=title)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


async def get_conversation(db, conv_id):
    result = await db.execute(select(Conversation).where(Conversation.id == uuid.UUID(conv_id)))
    return result.scalar_one_or_none()


async def get_user_conversations(db, user_id, limit=50):
    result = await db.execute(
        select(Conversation).where(Conversation.user_id == user_id)
        .order_by(desc(Conversation.updated_at)).limit(limit)
    )
    return result.scalars().all()


async def search_conversations(db, user_id, query, limit=15):
    """Search conversation titles, summaries, and message content."""
    title_result = await db.execute(
        select(Conversation)
        .where(
            Conversation.user_id == user_id,
            or_(
                Conversation.title.ilike(f"%{query}%"),
                Conversation.summary.ilike(f"%{query}%"),
            )
        )
        .order_by(desc(Conversation.updated_at))
        .limit(limit)
    )
    convs = list(title_result.scalars().all())
    existing_ids = {c.id for c in convs}

    needed = limit - len(convs)
    if needed > 0:
        where_clauses = [
            Conversation.user_id == user_id,
            Message.content.ilike(f"%{query}%"),
        ]
        if existing_ids:
            where_clauses.append(Conversation.id.notin_(list(existing_ids)))

        msg_result = await db.execute(
            select(Conversation)
            .join(Message, Message.conversation_id == Conversation.id)
            .where(*where_clauses)
            .distinct()
            .order_by(desc(Conversation.updated_at))
            .limit(needed)
        )
        convs += list(msg_result.scalars().all())

    return convs


async def delete_conversation(db, conv_id):
    conv = await get_conversation(db, conv_id)
    if conv:
        await db.delete(conv)
        await db.commit()
    return conv


async def rename_conversation(db, conv_id, title):
    from datetime import datetime, timezone
    await db.execute(
        update(Conversation).where(Conversation.id == uuid.UUID(conv_id))
        .values(title=title, updated_at=datetime.now(timezone.utc))
    )
    await db.commit()


async def delete_all_conversations(db, user_id):
    result = await db.execute(
        select(Conversation).where(Conversation.user_id == user_id)
    )
    convs = result.scalars().all()
    for conv in convs:
        await db.delete(conv)
    await db.commit()
    return len(convs)


async def update_conversation_summary(db, conv_id, summary, title=None):
    vals = {"summary": summary}
    if title:
        vals["title"] = title
    await db.execute(update(Conversation).where(Conversation.id == uuid.UUID(conv_id)).values(**vals))
    await db.commit()


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

async def add_message(db, conv_id, role, content, chunk_ids=None,
                       filter_source_type=None, filter_days=None):
    msg = Message(
        conversation_id=uuid.UUID(conv_id), role=role, content=content,
        retrieved_chunk_ids=[uuid.UUID(cid) for cid in (chunk_ids or [])],
        filter_source_type=filter_source_type, filter_days=filter_days,
    )
    db.add(msg)
    await db.execute(
        update(Conversation).where(Conversation.id == uuid.UUID(conv_id))
        .values(message_count=Conversation.message_count + 1)
    )
    await db.commit()
    await db.refresh(msg)
    return msg


async def get_recent_messages(db, conv_id, limit=6):
    result = await db.execute(
        select(Message).where(Message.conversation_id == uuid.UUID(conv_id))
        .order_by(desc(Message.created_at)).limit(limit)
    )
    return list(reversed(result.scalars().all()))


async def get_all_messages(db, conv_id):
    result = await db.execute(
        select(Message).where(Message.conversation_id == uuid.UUID(conv_id))
        .order_by(Message.created_at)
    )
    return result.scalars().all()


async def share_conversation(db, conv_id: str, user_id: str) -> str:
    """Generate (or return existing) share token for a conversation."""
    conv = await get_conversation(db, conv_id)
    if not conv or conv.user_id != user_id:
        return None
    if conv.share_token:
        return conv.share_token
    token = uuid.uuid4().hex  # 32-char random hex
    await db.execute(
        update(Conversation).where(Conversation.id == uuid.UUID(conv_id))
        .values(share_token=token)
    )
    await db.commit()
    return token


async def get_conversation_by_share_token(db, token: str):
    result = await db.execute(
        select(Conversation).where(Conversation.share_token == token)
    )
    return result.scalar_one_or_none()

import json
import asyncio
import google.generativeai as genai
from app.retrieval.retriever import retrieve
from app.db import crud
from app.db.client import AsyncSessionLocal
from app.chat.prompts import SYSTEM_PROMPT, format_chunks_for_prompt, format_recent_messages, format_document_list
from app.chat.memory import should_summarise, update_conversation_memory
from typing import Optional, AsyncGenerator


def build_retrieval_query(user_message: str, recent_messages, summary: str) -> str:
    """Enrich the retrieval query with conversation context for follow-ups."""
    context_parts = []
    if summary and summary != "No prior conversation.":
        context_parts.append(summary)
    for msg in (recent_messages or [])[-4:]:
        if msg.role == "user":
            context_parts.append(msg.content)
    context_parts.append(user_message)
    return " ".join(context_parts)[-500:]


async def generate_title(user_message: str, response_snippet: str, gemini_api_key: str) -> str:
    """Generate a short conversation title from the first exchange."""
    try:
        genai.configure(api_key=gemini_api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
        prompt = (
            f"Generate a concise 4-7 word title for a conversation that starts with this question:\n"
            f'"{user_message[:300]}"\n\n'
            f"Rules: No quotes, no punctuation at end, title case, be specific not generic."
        )
        result = await asyncio.get_event_loop().run_in_executor(
            None, lambda: model.generate_content(prompt)
        )
        title = result.text.strip().strip('"').strip("'")
        return title[:80] if title else user_message[:60]
    except Exception:
        return user_message[:60]


async def _save_title(conversation_id: str, user_message: str, snippet: str, gemini_api_key: str):
    """Generate and persist a conversation title in the background — doesn't block SSE done."""
    try:
        title = await generate_title(user_message, snippet, gemini_api_key)
        async with AsyncSessionLocal() as db:
            await crud.rename_conversation(db, conversation_id, title)
    except Exception:
        pass


async def stream_chat_response(
    db, user_id, conversation_id, user_message,
    source_type=None, days=None, top_n=6, gemini_api_key=None
) -> AsyncGenerator[str, None]:
    if not gemini_api_key:
        yield f"data: {json.dumps({'type': 'missing_key', 'message': 'Add your Gemini API key to start chatting.'})}\n\n"
        return

    genai.configure(api_key=gemini_api_key)

    conv = await crud.get_conversation(db, conversation_id)
    is_first_message = conv.message_count == 0
    summary = conv.summary or "No prior conversation."
    recent = await crud.get_recent_messages(db, conversation_id, limit=6)

    retrieval_query = build_retrieval_query(user_message, recent, summary)
    chunks, all_docs = await asyncio.gather(
        retrieve(db, user_id, retrieval_query, top_n=top_n, source_type=source_type,
                 days=days, gemini_api_key=gemini_api_key),
        crud.get_user_documents(db, user_id),
    )

    document_list, doc_count = format_document_list(all_docs)
    system = SYSTEM_PROMPT.format(
        doc_count=doc_count,
        document_list=document_list,
        retrieved_chunks=format_chunks_for_prompt(chunks),
        conversation_summary=summary,
        recent_messages=format_recent_messages(recent),
    )

    await crud.add_message(db, conversation_id, "user", user_message,
                            chunk_ids=[c["id"] for c in chunks],
                            filter_source_type=source_type, filter_days=days)

    model = genai.GenerativeModel("gemini-2.0-flash", system_instruction=system)

    def _generate():
        return model.generate_content(user_message, stream=True)

    full_response = ""

    chunk_meta = [
        {"id": c["id"], "source_title": c["source_title"],
         "heading": c.get("heading", ""), "content": c["content"][:200],
         "page_number": c.get("page_number")}
        for c in chunks
    ]

    yield f"data: {json.dumps({'type': 'sources', 'sources': chunk_meta})}\n\n"

    def _emit_error_event(exc: Exception) -> str:
        err_str = str(exc).lower()
        is_quota = any(k in err_str for k in ("429", "quota", "resource_exhausted", "rate limit", "too many requests"))
        is_invalid_key = any(k in err_str for k in ("api key not valid", "api_key_invalid", "permission", "400", "403"))
        is_overload = "503" in err_str or "unavailable" in err_str
        if is_quota:
            return f"data: {json.dumps({'type': 'quota_exceeded', 'message': 'Free Gemini quota is exhausted. Add your own free API key to keep going.'})}\n\n"
        if is_invalid_key:
            return f"data: {json.dumps({'type': 'invalid_key', 'message': 'Your Gemini key is invalid or out of quota. Update it and try again.'})}\n\n"
        error_msg = "Generation failed — model overloaded, please try again." if is_overload else "Generation failed. Please try again."
        return f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"

    # generate_content(stream=True) makes its FIRST network call eagerly,
    # so 429s during stream setup raise here — not during iteration.
    try:
        response = await asyncio.get_event_loop().run_in_executor(None, _generate)
    except Exception as e:
        yield _emit_error_event(e)
        return

    try:
        for part in response:
            if part.text:
                full_response += part.text
                yield f"data: {json.dumps({'type': 'token', 'content': part.text})}\n\n"
    except Exception as e:
        yield _emit_error_event(e)
        if full_response:
            await crud.add_message(db, conversation_id, "assistant", full_response,
                                    chunk_ids=[c["id"] for c in chunks])
        return

    await crud.add_message(db, conversation_id, "assistant", full_response,
                            chunk_ids=[c["id"] for c in chunks])

    if await should_summarise(db, conversation_id):
        asyncio.create_task(update_conversation_memory(conversation_id, gemini_api_key))

    # Title generation runs in background — done event fires immediately after tokens
    if is_first_message and not conv.title:
        asyncio.create_task(_save_title(conversation_id, user_message, full_response[:300], gemini_api_key))

    yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id})}\n\n"

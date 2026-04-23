import asyncio
import google.generativeai as genai
from app.config import settings
from app.db import crud
from app.db.client import AsyncSessionLocal
from app.chat.prompts import SUMMARISATION_PROMPT, TITLE_PROMPT


async def should_summarise(db, conv_id) -> bool:
    conv = await crud.get_conversation(db, conv_id)
    return conv is not None and conv.message_count > 0 and conv.message_count % 10 == 0


async def update_conversation_memory(conv_id: str):
    """Runs in a background task with its own session — never shares the request session."""
    async with AsyncSessionLocal() as db:
        conv = await crud.get_conversation(db, conv_id)
        if not conv:
            return

        all_messages = await crud.get_all_messages(db, conv_id)
        new_messages = all_messages[-10:]
        formatted = "\n".join([f"{m.role.upper()}: {m.content}" for m in new_messages])

        prompt = SUMMARISATION_PROMPT.format(
            existing_summary=conv.summary or "None", new_messages=formatted
        )

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None, lambda: model.generate_content(prompt)
            )
            new_summary = response.text.strip()
        except Exception:
            return

        new_title = conv.title
        if not new_title and all_messages:
            try:
                title_resp = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: model.generate_content(
                        TITLE_PROMPT.format(first_message=all_messages[0].content[:200])
                    )
                )
                new_title = title_resp.text.strip()[:80]
            except Exception:
                new_title = all_messages[0].content[:40] + "..."

        await crud.update_conversation_summary(db, conv_id, new_summary, new_title)

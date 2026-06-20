import asyncio
from datetime import date
import google.generativeai as genai
from sqlalchemy import text
from app.chat.prompts import DIGEST_PROMPT
from app.db import crud


async def get_recent_topics(db, user_id, limit=10) -> str:
    conversations = await crud.get_user_conversations(db, user_id, limit=limit)
    topics = []
    for conv in conversations:
        if conv.summary:
            topics.append(conv.summary[:150])
        elif conv.title:
            topics.append(conv.title)
    return "; ".join(topics) if topics else "No recent conversations."


async def get_random_chunks(db, user_id, limit=20) -> list[dict]:
    sql = text("""
        SELECT CAST(c.id AS text) AS id, c.content, c.heading, c.source_title,
               c.source_path, c.page_number
        FROM chunks c
        WHERE c.user_id = :user_id
        ORDER BY RANDOM()
        LIMIT :limit
    """)
    result = await db.execute(sql, {"user_id": user_id, "limit": limit})
    return [
        {"id": row.id, "content": row.content, "heading": row.heading,
         "source_title": row.source_title, "source_path": row.source_path,
         "page_number": row.page_number}
        for row in result.fetchall()
    ]


async def generate_daily_digest(db, user_id, gemini_api_key=None) -> dict:
    if not gemini_api_key:
        return {
            "date": str(date.today()),
            "items": [],
            "message": "Add your Gemini key to see your daily digest.",
        }

    recent_topics = await get_recent_topics(db, user_id)
    candidate_chunks = await get_random_chunks(db, user_id, limit=20)

    if not candidate_chunks:
        return {
            "date": str(date.today()),
            "items": [],
            "message": "Import some notes to get your daily digest!"
        }

    formatted = "\n\n---\n\n".join([
        f"Title: {c['source_title']}\nHeading: {c.get('heading', '')}\n{c['content'][:300]}"
        for c in candidate_chunks
    ])

    prompt = DIGEST_PROMPT.format(
        today=str(date.today()),
        recent_topics=recent_topics,
        candidate_chunks=formatted,
    )

    genai.configure(api_key=gemini_api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")

    try:
        response = await asyncio.get_event_loop().run_in_executor(
            None, lambda: model.generate_content(prompt)
        )
        raw = response.text.strip()
    except Exception as e:
        err = str(e)
        if "429" in err or "quota" in err.lower() or "rate" in err.lower():
            msg = "Gemini API quota temporarily exhausted — try again in a moment."
        elif "api_key" in err.lower() or "authentication" in err.lower():
            msg = "Gemini API key invalid or not configured."
        else:
            msg = "Could not generate digest right now."
        return {
            "date": str(date.today()),
            "items": [],
            "message": msg,
        }

    items = []
    for line in raw.split("\n"):
        line = line.strip()
        if line.startswith("NOTE:") and "|" in line:
            parts = line.split("|", 1)
            title = parts[0].replace("NOTE:", "").strip()
            relevance = parts[1].replace("RELEVANCE:", "").strip() if len(parts) > 1 else ""
            matching = [c for c in candidate_chunks if c["source_title"] in title]
            items.append({
                "title": title,
                "relevance": relevance,
                "chunk_id": matching[0]["id"] if matching else None,
                "source_title": matching[0]["source_title"] if matching else title,
            })

    return {
        "date": str(date.today()),
        "items": items[:5],
        "message": None,
    }

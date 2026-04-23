import asyncio
import google.generativeai as genai
from app.config import settings

EXPANSION_PROMPT = """The user asked: "{query}"

Generate 3 alternative phrasings of this question that would match different ways
the same idea might be written in personal notes or documents.
Output only the 3 alternatives, one per line, no numbering, no preamble."""


async def expand_query(query: str) -> list[str]:
    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    try:
        response = await asyncio.get_event_loop().run_in_executor(
            None, lambda: model.generate_content(EXPANSION_PROMPT.format(query=query))
        )
        expansions = [l.strip() for l in response.text.strip().split("\n") if l.strip()][:3]
        return [query] + expansions
    except Exception:
        return [query]

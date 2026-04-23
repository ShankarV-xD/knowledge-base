import re
from pathlib import Path
from app.ingestion.chunker import chunk_markdown, RawChunk


def strip_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    parts = text[3:].split("---", 1)
    if len(parts) < 2:
        return {}, text
    try:
        import yaml
        metadata = yaml.safe_load(parts[0]) or {}
    except Exception:
        metadata = {}
    return metadata, parts[1].strip()


def parse_markdown_file(file_path: str, content: str) -> list[RawChunk]:
    _, clean = strip_frontmatter(content)
    title = Path(file_path).stem
    return chunk_markdown(clean, source_title=title, source_path=file_path)

import io
import re
import zipfile
from pathlib import Path
from app.ingestion.chunker import chunk_markdown, RawChunk
from app.ingestion.parsers.markdown import strip_frontmatter

WIKILINK_RE = re.compile(r'\[\[([^\]]+)\]\]')
EMBED_RE = re.compile(r'!\[\[([^\]]+)\]\]')
TAG_RE = re.compile(r'(?<!\S)#([a-zA-Z0-9_/-]+)')


def clean_obsidian_markdown(text: str) -> str:
    text = EMBED_RE.sub('', text)
    text = WIKILINK_RE.sub(r'\1', text)
    text = TAG_RE.sub('', text)
    return text.strip()


def parse_obsidian_zip(zip_bytes: bytes, vault_name: str) -> list[RawChunk]:
    all_chunks = []
    chunk_offset = 0

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        md_files = [n for n in zf.namelist()
                    if n.endswith('.md') and not n.startswith('__MACOSX')]

        for filepath in sorted(md_files):
            try:
                raw = zf.read(filepath).decode('utf-8', errors='replace')
            except Exception:
                continue

            _, clean_text = strip_frontmatter(raw)
            clean_text = clean_obsidian_markdown(clean_text)
            if not clean_text.strip():
                continue

            note_name = Path(filepath).stem
            relative_path = filepath.replace(f"{vault_name}/", "")
            chunks = chunk_markdown(clean_text, source_title=note_name, source_path=relative_path)

            for chunk in chunks:
                chunk.chunk_index += chunk_offset

            all_chunks.extend(chunks)
            chunk_offset += len(chunks)

    return all_chunks

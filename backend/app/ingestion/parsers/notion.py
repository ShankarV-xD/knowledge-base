import io
import re
import zipfile
import csv
from pathlib import Path
from app.ingestion.chunker import chunk_markdown, RawChunk

NOTION_ID_RE = re.compile(r'\s[a-f0-9]{32}$')


def strip_notion_id(filename: str) -> str:
    stem = Path(filename).stem
    return NOTION_ID_RE.sub('', stem).strip()


def parse_csv_as_chunks(csv_content: str, title: str, source_path: str) -> list[RawChunk]:
    reader = csv.DictReader(io.StringIO(csv_content))
    rows = list(reader)
    if not rows:
        return []
    headers = list(rows[0].keys())
    chunks = []
    for i, row in enumerate(rows):
        lines = [f"**{h}:** {row.get(h, '').strip()}" for h in headers if row.get(h, '').strip()]
        content = "\n".join(lines)
        if content.strip():
            chunks.append(RawChunk(
                content=content, heading=title,
                source_title=title, source_path=source_path, chunk_index=i,
            ))
    return chunks


def parse_notion_zip(zip_bytes: bytes) -> list[RawChunk]:
    all_chunks = []
    chunk_offset = 0

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        all_files = zf.namelist()
        md_files = [f for f in all_files if f.endswith('.md') and not f.startswith('__MACOSX')]
        csv_files = [f for f in all_files if f.endswith('.csv') and not f.startswith('__MACOSX')]

        for filepath in sorted(md_files):
            try:
                raw = zf.read(filepath).decode('utf-8', errors='replace')
            except Exception:
                continue
            if not raw.strip():
                continue
            title = strip_notion_id(filepath)
            chunks = chunk_markdown(raw, source_title=title, source_path=filepath)
            for c in chunks:
                c.chunk_index += chunk_offset
            all_chunks.extend(chunks)
            chunk_offset += len(chunks)

        for filepath in sorted(csv_files):
            try:
                raw = zf.read(filepath).decode('utf-8', errors='replace')
            except Exception:
                continue
            title = strip_notion_id(filepath)
            chunks = parse_csv_as_chunks(raw, title, filepath)
            for c in chunks:
                c.chunk_index += chunk_offset
            all_chunks.extend(chunks)
            chunk_offset += len(chunks)

    return all_chunks

"""
Heading-aware markdown chunker.
CRITICAL: Do not replace this with character-count splitting.
Quality of retrieval depends entirely on quality of chunking.
"""
import re
import hashlib
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RawChunk:
    content: str
    heading: str
    source_title: str
    source_path: str
    chunk_index: int
    page_number: Optional[int] = None

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.content.strip().encode()).hexdigest()

    @property
    def token_count(self) -> int:
        return len(self.content.split())


def estimate_tokens(text: str) -> int:
    return len(text.split())


def split_by_headings(text: str) -> list[tuple[str, str]]:
    lines = text.split("\n")
    sections = []
    current_heading = ""
    current_lines = []

    for line in lines:
        h1 = re.match(r'^# (.+)$', line)
        h2 = re.match(r'^## (.+)$', line)
        if h1 or h2:
            if current_lines:
                content = "\n".join(current_lines).strip()
                if content:
                    sections.append((current_heading, content))
            current_heading = (h1 or h2).group(1).strip()
            current_lines = []
        else:
            current_lines.append(line)

    if current_lines:
        content = "\n".join(current_lines).strip()
        if content:
            sections.append((current_heading, content))

    if not sections:
        sections = [("", text.strip())]

    return sections


def chunk_section(heading, content, source_title, source_path,
                  start_index, max_tokens=400, overlap_paragraphs=1):
    if estimate_tokens(content) <= max_tokens:
        return [RawChunk(
            content=f"## {heading}\n\n{content}" if heading else content,
            heading=heading, source_title=source_title,
            source_path=source_path, chunk_index=start_index,
        )]

    paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
    chunks = []
    window = []
    chunk_idx = start_index

    for para in paragraphs:
        window.append(para)
        if estimate_tokens("\n\n".join(window)) >= max_tokens:
            full_content = f"## {heading}\n\n" + "\n\n".join(window) if heading else "\n\n".join(window)
            chunks.append(RawChunk(
                content=full_content, heading=heading,
                source_title=source_title, source_path=source_path, chunk_index=chunk_idx,
            ))
            chunk_idx += 1
            window = window[-overlap_paragraphs:] if overlap_paragraphs > 0 else []

    if window:
        full_content = f"## {heading}\n\n" + "\n\n".join(window) if heading else "\n\n".join(window)
        if estimate_tokens(full_content) > 20:
            chunks.append(RawChunk(
                content=full_content, heading=heading,
                source_title=source_title, source_path=source_path, chunk_index=chunk_idx,
            ))

    return chunks


def chunk_markdown(text, source_title, source_path=""):
    if not text or not text.strip():
        return []
    sections = split_by_headings(text)
    all_chunks = []
    chunk_idx = 0
    for heading, content in sections:
        section_chunks = chunk_section(heading, content, source_title, source_path, chunk_idx)
        all_chunks.extend(section_chunks)
        chunk_idx += len(section_chunks)
    return all_chunks


def chunk_plain_text(text, source_title, source_path=""):
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    window = []
    idx = 0
    for para in paragraphs:
        window.append(para)
        if estimate_tokens("\n\n".join(window)) >= 350:
            chunks.append(RawChunk(
                content="\n\n".join(window), heading="",
                source_title=source_title, source_path=source_path, chunk_index=idx,
            ))
            idx += 1
            window = window[-1:]
    if window:
        chunks.append(RawChunk(
            content="\n\n".join(window), heading="",
            source_title=source_title, source_path=source_path, chunk_index=idx,
        ))
    return chunks

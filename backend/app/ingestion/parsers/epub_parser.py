import io
import re
from app.ingestion.chunker import RawChunk, chunk_markdown


def parse_epub(file_bytes: bytes, doc_title: str) -> list[RawChunk]:
    import ebooklib
    from ebooklib import epub
    from bs4 import BeautifulSoup

    book = epub.read_epub(io.BytesIO(file_bytes), options={"ignore_ncx": True})

    # Collect documents in spine order for correct chapter sequence
    spine_ids = [item_id for item_id, _ in book.spine]
    ordered_items = []
    for item_id in spine_ids:
        item = book.get_item_with_id(item_id)
        if item and item.get_type() == ebooklib.ITEM_DOCUMENT:
            ordered_items.append(item)

    # Fall back to all documents if spine is empty
    if not ordered_items:
        ordered_items = list(book.get_items_of_type(ebooklib.ITEM_DOCUMENT))

    sections: list[str] = []
    for item in ordered_items:
        soup = BeautifulSoup(item.get_content(), "lxml")
        for tag in soup(["script", "style", "nav"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        if text and len(text) > 20:  # skip near-empty boilerplate pages
            sections.append(text)

    content = "\n\n".join(sections)
    return chunk_markdown(content, source_title=doc_title, source_path=doc_title)

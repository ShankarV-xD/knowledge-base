import re
from app.ingestion.chunker import RawChunk, chunk_markdown


def parse_html(file_bytes: bytes, doc_title: str) -> list[RawChunk]:
    from bs4 import BeautifulSoup

    html = file_bytes.decode("utf-8", errors="replace")
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    return chunk_markdown(text, source_title=doc_title, source_path=doc_title)

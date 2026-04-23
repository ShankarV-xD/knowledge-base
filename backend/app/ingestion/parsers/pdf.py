import io
import asyncio
import google.generativeai as genai
from app.config import settings
from app.ingestion.chunker import RawChunk, chunk_plain_text

# Pages with fewer than this many chars of extracted text get vision fallback
MIN_PAGE_CHARS = 80


def _sanitize(text: str) -> str:
    """Remove null bytes and other characters PostgreSQL UTF-8 rejects."""
    return text.replace("\x00", "").encode("utf-8", errors="replace").decode("utf-8")


def _extract_text_pypdf2(pdf_bytes: bytes) -> list[tuple[int, str]]:
    import PyPDF2
    pages = []
    reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
    for i, page in enumerate(reader.pages):
        try:
            pages.append((i + 1, _sanitize(page.extract_text() or "")))
        except Exception:
            pages.append((i + 1, ""))
    return pages


def _extract_text_pdfplumber(pdf_bytes: bytes) -> list[tuple[int, str]]:
    import pdfplumber
    pages = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for i, page in enumerate(pdf.pages):
            try:
                pages.append((i + 1, _sanitize(page.extract_text() or "")))
            except Exception:
                pages.append((i + 1, ""))
    return pages


def _render_page_as_png(pdf_bytes: bytes, page_num: int) -> bytes:
    """Render a PDF page to PNG bytes using pymupdf (no system deps)."""
    import fitz  # pymupdf
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc[page_num - 1]
    # 150 DPI — good enough for vision, keeps image size reasonable
    mat = fitz.Matrix(150 / 72, 150 / 72)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    return pix.tobytes("png")


async def _describe_page_with_vision(
    pdf_bytes: bytes, page_num: int, title: str
) -> str:
    """Ask Gemini Vision to describe an image-heavy page. Free-tier friendly."""
    genai.configure(api_key=settings.gemini_api_key)
    try:
        png_bytes = await asyncio.get_event_loop().run_in_executor(
            None, _render_page_as_png, pdf_bytes, page_num
        )
        model = genai.GenerativeModel("gemini-2.0-flash")
        prompt = (
            f"This is page {page_num} of a document titled '{title}'. "
            "Extract and transcribe ALL visible content: text, headings, labels, "
            "table data, chart values, diagram annotations, captions, and any "
            "numbers or figures. Be thorough and structured. Do not describe "
            "visual style — focus entirely on the information content."
        )
        image_part = {"mime_type": "image/png", "data": png_bytes}
        result = await asyncio.get_event_loop().run_in_executor(
            None, lambda: model.generate_content([prompt, image_part])
        )
        return result.text.strip()
    except Exception as e:
        return ""  # Silently skip — don't fail the whole ingestion


def _make_chunks(page_text: str, page_num: int, title: str,
                 chunk_offset: int, via_vision: bool = False) -> list[RawChunk]:
    chunks = chunk_plain_text(
        page_text,
        source_title=f"{title} (p.{page_num})",
        source_path=f"{title}/page_{page_num}",
    )
    for chunk in chunks:
        chunk.page_number = page_num
        chunk.chunk_index += chunk_offset
        if not chunk.heading:
            chunk.heading = f"Page {page_num}" + (" [image]" if via_vision else "")
    return chunks


async def parse_pdf(pdf_bytes: bytes, title: str) -> list[RawChunk]:
    # 1. Try fast text extraction first
    pages = _extract_text_pypdf2(pdf_bytes)

    # If >30% of pages are nearly empty, retry with pdfplumber (handles complex layouts)
    empty = sum(1 for _, t in pages if len(t.strip()) < MIN_PAGE_CHARS)
    if pages and empty / len(pages) > 0.3:
        pages = _extract_text_pdfplumber(pdf_bytes)

    all_chunks: list[RawChunk] = []
    chunk_offset = 0

    # 2. Identify which pages need vision
    text_pages = [(n, t) for n, t in pages if len(t.strip()) >= MIN_PAGE_CHARS]
    image_page_nums = [n for n, t in pages if len(t.strip()) < MIN_PAGE_CHARS]

    # 3. Process text pages synchronously
    for page_num, page_text in text_pages:
        chunks = _make_chunks(page_text, page_num, title, chunk_offset)
        all_chunks.extend(chunks)
        chunk_offset += len(chunks)

    # 4. Process image-heavy pages concurrently via Gemini Vision
    if image_page_nums:
        vision_tasks = [
            _describe_page_with_vision(pdf_bytes, n, title)
            for n in image_page_nums
        ]
        descriptions = await asyncio.gather(*vision_tasks)

        for page_num, description in zip(image_page_nums, descriptions):
            if not description or len(description.strip()) < MIN_PAGE_CHARS:
                continue
            chunks = _make_chunks(description, page_num, title, chunk_offset, via_vision=True)
            all_chunks.extend(chunks)
            chunk_offset += len(chunks)

    # Sort by page number so retrieval ordering makes sense
    all_chunks.sort(key=lambda c: (c.page_number or 0, c.chunk_index))
    return all_chunks

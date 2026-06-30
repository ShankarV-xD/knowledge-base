import io
import uuid
import re
from app.db import crud
from app.db.client import AsyncSessionLocal
from app.ingestion.chunker import RawChunk, chunk_markdown
from app.ingestion.embedder import embed_chunks
from app.ingestion.parsers import markdown, obsidian, notion, pdf
from app.storage import supabase_storage


async def detect_source_type(filename: str, content_type: str) -> str:
    fname = filename.lower()
    if fname.endswith('.pdf'):
        return 'pdf'
    if fname.endswith('.zip'):
        return 'obsidian'  # auto-detected as obsidian/notion inside parse_file
    if fname.endswith('.docx'):
        return 'docx'
    if fname.endswith('.pptx'):
        return 'pptx'
    if fname.endswith('.xlsx'):
        return 'xlsx'
    if fname.endswith('.csv'):
        return 'csv'
    if fname.endswith('.epub'):
        return 'epub'
    if fname.endswith(('.html', '.htm')):
        return 'html'
    # .md, .txt, and anything else → markdown parser
    return 'markdown'


async def parse_file(file_bytes, filename, source_type, doc_title, gemini_api_key) -> list[RawChunk]:
    if source_type == 'pdf':
        return await pdf.parse_pdf(file_bytes, doc_title, gemini_api_key)
    if source_type == 'markdown':
        content = file_bytes.decode('utf-8', errors='replace')
        return markdown.parse_markdown_file(filename, content)
    if source_type in ('obsidian', 'notion'):
        import zipfile
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
                names = zf.namelist()
                is_notion = any(
                    len(n.split('/')[-1].split('.')[0]) > 32
                    for n in names if n.endswith('.md')
                )
        except Exception:
            is_notion = False
        return notion.parse_notion_zip(file_bytes) if is_notion else \
               obsidian.parse_obsidian_zip(file_bytes, doc_title)
    if source_type == 'docx':
        from app.ingestion.parsers import docx_parser
        return docx_parser.parse_docx(file_bytes, doc_title)
    if source_type == 'pptx':
        from app.ingestion.parsers import pptx_parser
        return pptx_parser.parse_pptx(file_bytes, doc_title)
    if source_type == 'xlsx':
        from app.ingestion.parsers import spreadsheet_parser
        return spreadsheet_parser.parse_xlsx(file_bytes, doc_title)
    if source_type == 'csv':
        from app.ingestion.parsers import spreadsheet_parser
        return spreadsheet_parser.parse_csv(file_bytes, doc_title)
    if source_type == 'epub':
        from app.ingestion.parsers import epub_parser
        return epub_parser.parse_epub(file_bytes, doc_title)
    if source_type == 'html':
        from app.ingestion.parsers import html_parser
        return html_parser.parse_html(file_bytes, doc_title)
    return []


async def _embed_and_store(db, doc_id, user_id, raw_chunks, doc_title, gemini_api_key):
    """Shared helper: embed chunks and persist them. Returns True on success."""
    existing_hashes = await crud.get_existing_hashes(db, user_id)
    new_chunks = [c for c in raw_chunks if c.content_hash not in existing_hashes]

    if not new_chunks:
        await crud.update_document_status(
            db, doc_id, "done",
            chunk_count=len(raw_chunks),
            token_count=sum(c.token_count for c in raw_chunks),
        )
        return True

    embeddings = await embed_chunks(new_chunks, gemini_api_key)

    chunk_rows = []
    for chunk, embedding in zip(new_chunks, embeddings):
        if embedding is None:
            continue
        chunk_rows.append({
            "id": uuid.uuid4(),
            "document_id": uuid.UUID(doc_id),
            "user_id": user_id,
            "content": chunk.content,
            "content_hash": chunk.content_hash,
            "heading": chunk.heading,
            "source_title": chunk.source_title,
            "source_path": chunk.source_path,
            "chunk_index": chunk.chunk_index,
            "token_count": chunk.token_count,
            "page_number": chunk.page_number,
            "embedding": embedding,
        })

    await crud.bulk_insert_chunks(db, chunk_rows)
    await crud.update_document_status(
        db, doc_id, "done",
        chunk_count=len(chunk_rows),
        token_count=sum(c.token_count for c in raw_chunks),
    )
    return True


async def process_document_background(doc_id, file_bytes, filename,
                                       source_type, doc_title, user_id, gemini_api_key):
    async with AsyncSessionLocal() as db:
        try:
            await crud.update_document_status(db, doc_id, "processing")

            raw_chunks = await parse_file(file_bytes, filename, source_type, doc_title, gemini_api_key)
            if not raw_chunks:
                await crud.update_document_status(
                    db, doc_id, "error",
                    error_message="No text could be extracted from this file."
                )
                return

            await _embed_and_store(db, doc_id, user_id, raw_chunks, doc_title, gemini_api_key)

        except Exception as e:
            await db.rollback()
            await crud.update_document_status(db, doc_id, "error", error_message=str(e)[:500])


async def retry_document_background(doc_id: str, user_id: str, file_path: str,
                                     filename: str, source_type: str, doc_title: str,
                                     gemini_api_key: str):
    """Re-run ingestion for a document that previously failed."""
    # URL-sourced documents: re-fetch and re-process
    if file_path.startswith("http://") or file_path.startswith("https://"):
        await process_url_background(doc_id, file_path, None, doc_title, user_id, gemini_api_key)
        return

    try:
        if supabase_storage.is_storage_ref(file_path):
            file_bytes = await supabase_storage.download_bytes(file_path)
        else:
            with open(file_path, "rb") as f:
                file_bytes = f.read()
    except Exception as e:
        async with AsyncSessionLocal() as db:
            await crud.update_document_status(
                db, doc_id, "error",
                error_message=f"Original file not found for retry: {str(e)[:200]}"
            )
        return

    await process_document_background(doc_id, file_bytes, filename, source_type, doc_title, user_id, gemini_api_key)


async def process_url_background(doc_id: str, url: str, html_content,
                                   doc_title: str, user_id: str, gemini_api_key: str):
    """Fetch a web page, extract text, chunk, embed, and store."""
    async with AsyncSessionLocal() as db:
        try:
            await crud.update_document_status(db, doc_id, "processing")

            # Fetch if not already provided
            if html_content is None:
                import httpx
                async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
                    resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                    resp.raise_for_status()
                    html_content = resp.text

            # Extract readable text with BeautifulSoup
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html_content, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)
            text = re.sub(r'\n{3,}', '\n\n', text).strip()

            if not text:
                await crud.update_document_status(
                    db, doc_id, "error",
                    error_message="No readable text could be extracted from this URL."
                )
                return

            raw_chunks = chunk_markdown(text, source_title=doc_title, source_path=url)

            if not raw_chunks:
                await crud.update_document_status(
                    db, doc_id, "error",
                    error_message="No content chunks could be created from this URL."
                )
                return

            await _embed_and_store(db, doc_id, user_id, raw_chunks, doc_title, gemini_api_key)

        except Exception as e:
            await db.rollback()
            await crud.update_document_status(db, doc_id, "error", error_message=str(e)[:500])

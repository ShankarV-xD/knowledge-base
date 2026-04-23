# Knowledge Base — Complete Codebase Reference

Everything you need to understand, explain, extend, or debug this application. Written so that reading this once makes you the authority on every part of the system.

---

## Table of Contents

1. [What This App Does](#1-what-this-app-does)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Repository Structure](#4-repository-structure)
5. [Database Schema](#5-database-schema)
6. [Backend — Startup & Configuration](#6-backend--startup--configuration)
7. [Authentication System](#7-authentication-system)
8. [Document Ingestion Pipeline](#8-document-ingestion-pipeline)
9. [Embedding System](#9-embedding-system)
10. [Retrieval System (RAG)](#10-retrieval-system-rag)
11. [Chat System](#11-chat-system)
12. [Daily Digest](#12-daily-digest)
13. [Caching Layer](#13-caching-layer)
14. [Rate Limiting](#14-rate-limiting)
15. [Frontend Architecture](#15-frontend-architecture)
16. [Auth Flow (Frontend)](#16-auth-flow-frontend)
17. [Chat Page — State & Data Flow](#17-chat-page--state--data-flow)
18. [Streaming (SSE)](#18-streaming-sse)
19. [Document Library](#19-document-library)
20. [Charts](#20-charts)
21. [Filter Bar](#21-filter-bar)
22. [Sidebar](#22-sidebar)
23. [Gemini API Key Override](#23-gemini-api-key-override)
24. [Export (Markdown & PDF)](#24-export-markdown--pdf)
25. [Database Migrations (Alembic)](#25-database-migrations-alembic)
26. [Operational Infrastructure](#26-operational-infrastructure)
27. [Performance Decisions](#27-performance-decisions)
28. [Known Limitations & Bugs](#28-known-limitations--bugs)
29. [Environment Variables Reference](#29-environment-variables-reference)
30. [API Endpoint Reference](#30-api-endpoint-reference)
31. [Data Flow Diagrams](#31-data-flow-diagrams)

---

## 1. What This App Does

A personal knowledge base that lets you chat with your own notes using AI. You import documents (PDFs, Markdown files, Obsidian vaults, Notion exports, web URLs), and then ask questions in natural language. The AI answers exclusively from your documents — never from its training data — and cites exactly which notes it used.

Core capabilities:
- **Chat with RAG** — retrieval-augmented generation, answers grounded in your documents
- **Streaming responses** — tokens appear as they are generated
- **Source citations** — every answer shows which chunks it used, clickable to preview
- **Charts** — ask for a chart and the AI produces a rendered Recharts visualization
- **Filter** — narrow retrieval to a specific source type (PDF, Obsidian, etc.) or time window
- **Daily digest** — AI-curated "notes worth revisiting today" based on your recent activity
- **Multi-format import** — PDF, Word (`.docx`), PowerPoint (`.pptx`), Excel (`.xlsx`), CSV, EPUB, HTML, Markdown (`.md`), plain text (`.txt`), Obsidian/Notion `.zip` exports, web URLs
- **Conversation memory** — past conversations are summarised to maintain context
- **Export** — conversations downloadable as Markdown or PDF (via jsPDF)

---

## 2. High-Level Architecture

```
Browser (Next.js 14)
    │
    ├── /login              Login / Register page
    ├── /chat/[id]          Main chat interface
    └── /library            Document library
         │
         │  REST + SSE (HTTP)
         ▼
FastAPI Backend (Python 3.11)
    │
    ├── Auth router          JWT issue / verify
    ├── Upload router        File intake → ingestion queue
    ├── Chat router          SSE stream → Gemini
    ├── Documents router     CRUD on documents
    └── Digest router        Daily note recommendations
         │
    ┌────┴─────────────────────────────────────────┐
    │                                              │
    ▼                                              ▼
PostgreSQL (Supabase)                    Upstash Redis
  pgvector extension                     Embedding cache
  Full-text search (tsvector)            (7-day TTL for chunks)
  5 tables: users, documents,            (1-hour TTL for queries)
  chunks, conversations, messages
                                         Falls back to in-memory
                                         dict if Redis unavailable
    │
    ▼
Google Gemini API
  gemini-2.5-flash    → chat responses
  gemini-2.0-flash    → query expansion, summarisation, title generation
  gemini-embedding-001 → 768-dim embeddings (truncated from 3072)
```

---

## 3. Technology Stack

### Backend
| Layer | Technology | Why |
|---|---|---|
| Web framework | FastAPI | Async-native, built-in OpenAPI, StreamingResponse for SSE |
| ORM | SQLAlchemy (async) | Type-safe, works with asyncpg |
| DB driver | asyncpg | Fastest async PostgreSQL driver |
| Database | PostgreSQL via Supabase | Managed, has pgvector built-in |
| Vector search | pgvector | cosine similarity via `<=>` operator |
| Full-text search | PostgreSQL tsvector | Built-in BM25-like ranking with `ts_rank_cd` |
| AI | Google Gemini (genai SDK) | Single provider for chat + embeddings |
| Cache | Upstash Redis (REST) | Serverless Redis, no connection pool needed |
| Auth | PyJWT + bcrypt | Standard JWT with HS256, bcrypt for password hashing |
| PDF parsing | PyMuPDF (fitz) | Fast, accurate text + page number extraction |
| HTML parsing | BeautifulSoup4 | For web URL import |
| HTTP client | httpx | Async HTTP for URL fetching |
| Config | pydantic-settings | Reads `.env` automatically, type-validated |

### Frontend
| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server components, middleware, file-based routing |
| Language | TypeScript | Type safety throughout |
| Styling | Tailwind CSS | Utility-first, dark theme via custom design tokens |
| Animation | Framer Motion | Smooth sidebar, modals, message entry |
| Markdown | react-markdown + remark-gfm | Renders AI responses with full GFM support |
| Charts | Recharts | Composable, `isAnimationActive={false}` prevents re-draw flicker |
| PDF export | jsPDF | Client-side PDF generation, no server needed |
| Dates | date-fns | Lightweight date formatting |
| State | React useState/useCallback/useRef | No external state library needed at this scale |

---

## 4. Repository Structure

```
Backend/
├── CODEBASE.md          This file — complete reference
├── DEPLOYMENT.md        Deployment guide
├── README.md            Project overview
├── .github/
│   └── workflows/
│       └── keep_supabase_alive.yml   GitHub Action: pings Supabase every 6h
│
├── backend/
│   ├── app/
│   │   ├── main.py              FastAPI app, CORS, startup hooks, router registration
│   │   ├── config.py            Pydantic settings, reads .env
│   │   ├── api/
│   │   │   ├── auth.py          POST /api/auth/register, /login, GET /me
│   │   │   ├── chat.py          POST /api/chat/send (SSE), conversation CRUD, search
│   │   │   ├── documents.py     GET/DELETE/PATCH/retry /api/documents
│   │   │   ├── upload.py        POST /api/upload (file), /api/upload/url
│   │   │   ├── digest.py        GET /api/digest
│   │   │   └── health.py        GET /api/health
│   │   ├── auth/
│   │   │   ├── jwt_utils.py     create_access_token, verify_token
│   │   │   └── dependency.py    get_current_user FastAPI dependency
│   │   ├── db/
│   │   │   ├── models.py        SQLAlchemy ORM models (5 tables)
│   │   │   ├── client.py        Async engine, session factory, get_db dependency
│   │   │   ├── crud.py          All database read/write functions
│   │   │   └── ensure_indexes.py Creates tsvector trigger + pgvector index on startup
│   │   ├── ingestion/
│   │   │   ├── pipeline.py      Orchestrates parse → chunk → embed → store
│   │   │   ├── chunker.py       Heading-aware markdown chunker (core quality logic)
│   │   │   ├── embedder.py      Gemini embedding calls, batching, caching
│   │   │   ├── queue.py         Single-worker async queue (prevents duplicate-hash races)
│   │   │   └── parsers/
│   │   │       ├── pdf.py              PyMuPDF extraction, page number tracking
│   │   │       ├── markdown.py         Plain .md / .txt file parser
│   │   │       ├── obsidian.py         Zip extraction, frontmatter stripping
│   │   │       ├── notion.py           Notion HTML/MD export handling
│   │   │       ├── docx_parser.py      python-docx: paragraphs + headings + tables
│   │   │       ├── pptx_parser.py      python-pptx: slide text + speaker notes
│   │   │       ├── spreadsheet_parser.py  openpyxl (xlsx) + stdlib csv
│   │   │       ├── epub_parser.py      ebooklib + BS4: spine-ordered chapters
│   │   │       └── html_parser.py      BS4: same logic as URL import
│   │   ├── retrieval/
│   │   │   ├── retriever.py     Top-level: expand → embed → vector+BM25 → RRF
│   │   │   ├── vector_search.py pgvector cosine similarity query
│   │   │   ├── bm25_search.py   PostgreSQL full-text search
│   │   │   ├── rrf.py           Reciprocal Rank Fusion merge algorithm
│   │   │   └── expander.py      Query expansion via Gemini
│   │   ├── chat/
│   │   │   ├── handler.py       Build prompt → stream Gemini → save messages
│   │   │   ├── memory.py        Conversation summarisation (every 10 messages)
│   │   │   └── prompts.py       All prompt templates + format helpers
│   │   ├── digest/
│   │   │   └── daily.py         Random chunk selection → Gemini digest generation
│   │   ├── cache/
│   │   │   └── redis_client.py  Upstash Redis wrapper with in-memory fallback
│   │   └── middleware/
│   │       └── rate_limit.py    In-memory sliding window rate limiter
│   ├── alembic/
│   │   ├── env.py               Alembic environment config
│   │   └── versions/
│   │       ├── 001_initial_schema.py    Baseline: all 5 tables, vector(3072)
│   │       └── 002_embedding_768dim.py  Shrink to vector(768), HNSW index
│   └── .env                     Secret keys (never commit)
│
└── frontend/
    ├── app/
    │   ├── layout.tsx           Root layout, dark mode, font
    │   ├── providers.tsx        AuthProvider wrapper
    │   ├── page.tsx             Root redirect to /chat/new
    │   ├── globals.css          Global styles + .scrollbar-none utility
    │   ├── login/page.tsx       Login + register page
    │   ├── chat/[conversationId]/page.tsx   Main chat page (most complex file)
    │   └── library/page.tsx     Document library page
    ├── components/
    │   ├── layout/
    │   │   ├── AppShell.tsx     Main layout: sidebar + main + modals
    │   │   └── Sidebar.tsx      Conversations, documents, nav buttons
    │   ├── chat/
    │   │   ├── MessageList.tsx  Renders all messages (React.memo)
    │   │   ├── UserMessage.tsx  User bubble
    │   │   ├── AssistantMessage.tsx  AI response + sources + actions (React.memo)
    │   │   ├── ChatInput.tsx    Textarea + send/stop button + topN selector
    │   │   ├── ChartRenderer.tsx  Recharts chart from JSON config
    │   │   ├── SourceBadge.tsx  Numbered source pill
    │   │   └── SourcePopover.tsx  Hover popover for source preview
    │   ├── upload/
    │   │   ├── DropZone.tsx     Drag-and-drop file upload modal
    │   │   └── IngestionProgress.tsx  Top progress bar during processing
    │   ├── library/
    │   │   ├── DocumentPreviewModal.tsx  Full-screen document chunk viewer
    │   │   ├── DocumentCard.tsx  Library card
    │   │   └── DocumentStatus.tsx  Status badge component
    │   ├── digest/
    │   │   ├── DigestModal.tsx  Daily digest overlay
    │   │   └── DigestCard.tsx   Individual digest item card
    │   └── ui/
    │       ├── FilterBar.tsx    Source type + time period filter pills
    │       ├── ConversationSearchModal.tsx  Cmd+K search
    │       ├── EmptyState.tsx   Reusable empty state with optional action button
    │       ├── ErrorBoundary.tsx  React error boundary (wraps ChartRenderer)
    │       └── GeminiKeyModal.tsx  User's own Gemini API key input
    ├── lib/
    │   ├── api.ts               All REST API calls (typed)
    │   ├── sse.ts               SSE streaming for chat
    │   ├── auth-context.tsx     React context for user session
    │   ├── auth-token.ts        localStorage + cookie helpers (JWT + Gemini key)
    │   └── export.ts            Markdown + PDF export logic (jsPDF)
    ├── hooks/
    │   └── useIngestionStatus.ts  Polls /documents, drives progress bar
    ├── middleware.ts             Next.js route protection (checks kb_token cookie)
    └── types/index.ts           Shared TypeScript interfaces
```

---

## 5. Database Schema

### users
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
email         TEXT NOT NULL UNIQUE (indexed)
password_hash TEXT NOT NULL
created_at    TIMESTAMPTZ DEFAULT NOW()
```

### documents
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id       TEXT NOT NULL           -- string, not FK (supports "admin-demo-user")
title         TEXT NOT NULL
source_type   TEXT NOT NULL           -- "pdf" | "markdown" | "obsidian" | "docx" | "pptx"
                                       -- | "xlsx" | "csv" | "epub" | "html"
                                       -- NOTE: Notion zips are stored as "obsidian"!
file_path     TEXT                    -- disk path for files, URL for web imports
chunk_count   INTEGER DEFAULT 0
token_count   INTEGER DEFAULT 0
status        TEXT DEFAULT 'pending'  -- "pending" | "processing" | "done" | "error"
error_message TEXT
created_at    TIMESTAMPTZ DEFAULT NOW()
updated_at    TIMESTAMPTZ DEFAULT NOW() (auto-updated via ORM onupdate)
```

### chunks
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
document_id   UUID REFERENCES documents(id) ON DELETE CASCADE
user_id       TEXT NOT NULL
content       TEXT NOT NULL           -- includes "## Heading\n\n" prefix if heading exists
content_hash  TEXT NOT NULL           -- SHA-256 of content, deduplication key
heading       TEXT                    -- extracted heading (stored separately for display)
source_title  TEXT NOT NULL
source_path   TEXT
chunk_index   INTEGER NOT NULL        -- position within document
token_count   INTEGER                 -- word count (approximate)
page_number   INTEGER                 -- for PDFs only
embedding     vector(768)             -- Gemini gemini-embedding-001, first 768 of 3072 dims
created_at    TIMESTAMPTZ DEFAULT NOW()
-- search_vector is a tsvector column added by a DB trigger (not in ORM model)
```

**Indexes on chunks:**
- `user_id` — filters by user before any search
- GIN index on `search_vector` — required for `@@` full-text operator
- HNSW index on `embedding` (created by migration 002):
  ```sql
  CREATE INDEX chunks_embedding_hnsw_idx ON chunks
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)
  ```
  HNSW = Hierarchical Navigable Small World graph, the fastest ANN algorithm for pgvector.
  `m=16` = max connections per node, `ef_construction=64` = beam width during build.

### conversations
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id       TEXT NOT NULL
title         TEXT                    -- AI-generated after first exchange (async)
summary       TEXT                    -- rolling AI summary, updated every 10 messages
message_count INTEGER DEFAULT 0
created_at    TIMESTAMPTZ DEFAULT NOW()
updated_at    TIMESTAMPTZ DEFAULT NOW() (bumped on rename or summary update)
```

### messages
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
conversation_id     UUID REFERENCES conversations(id) ON DELETE CASCADE
role                TEXT NOT NULL       -- "user" | "assistant"
content             TEXT NOT NULL
retrieved_chunk_ids UUID[]              -- which chunks were used for this response
filter_source_type  TEXT                -- filter active when this message was sent
filter_days         INTEGER             -- days filter active when this message was sent
created_at          TIMESTAMPTZ DEFAULT NOW()
```

---

## 6. Backend — Startup & Configuration

### `config.py`
Uses `pydantic-settings` with `BaseSettings`. Reads from environment variables and `.env` automatically. Every field is typed; missing required fields raise at import time, not at runtime.

Key settings:
```python
gemini_api_key         # default Gemini key used when no user key provided
database_url           # asyncpg-compatible PostgreSQL URL
auth_secret            # HS256 JWT signing secret (must be ≥32 chars in production)
upstash_redis_rest_url # optional; cache falls back to memory if absent
upstash_redis_rest_token
allowed_origins        # comma-separated CORS origins (default: "http://localhost:3000")
max_upload_size_mb     # default: 50
upload_dir             # where uploaded files are saved on disk
```

### `main.py` startup sequence

When uvicorn starts, the `@app.on_event("startup")` async handler runs:

1. **`_validate_settings()`** — logs `WARNING` for:
   - `AUTH_SECRET` shorter than 32 chars
   - `AUTH_SECRET` still set to the "changeme" placeholder
   - Missing `GEMINI_API_KEY` or `DATABASE_URL`
   Does not crash, only warns. This prevents silent misconfiguration.

2. **`reset_stuck_documents(db)`** — scans and resets two cases:
   - Documents in `"processing"` status → server crashed mid-ingestion
   - Documents in `"pending"` status with `chunk_count > 0` → queued by migration 002 but never picked up (migration set all docs to `pending` for re-embedding)
   Both get reset to `"error"` with a descriptive message, so the retry button appears.

3. **`start_ingestion_worker()`** — creates the single asyncio task that drains the ingestion queue.

4. **`ensure_schema()`** — idempotently:
   - Creates the `users` table if it doesn't exist
   - Detects the current `embedding` column dimension from `pg_attribute`
   - If dim ≤ 2000: creates HNSW index with `IF NOT EXISTS`
   - If dim > 2000: logs info that exact scan will be used

CORS configuration:
```python
allow_origins=settings.allowed_origins.split(",")
allow_credentials=True
allow_methods=["*"]
allow_headers=["*", "X-Gemini-Key"]     # X-Gemini-Key must be explicitly listed
expose_headers=["X-Conversation-Id"]    # frontend reads this to get new conv ID
```

`@app.on_event("shutdown")`: disposes the SQLAlchemy async engine gracefully.

---

## 7. Authentication System

### How it works

**Registration** (`POST /api/auth/register`):
1. Rate-limit: 5 req/60s per IP (`check_rate_limit(f"register:{ip}")`)
2. Validate: email must contain `@`, password must be ≥8 chars
3. Check email not already in use (`crud.get_user_by_email`)
4. Hash password: `bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()`
5. Insert user row
6. Return JWT token + user object

**Login** (`POST /api/auth/login`):
1. Rate-limit: 10 req/60s per IP
2. **Hardcoded test account**: if `email == "admin"` and `password == "password"`, skip DB lookup and return a token with `user_id = "admin-demo-user"` (remove before sharing with anyone)
3. Look up user by email
4. `bcrypt.checkpw(provided, stored_hash)` — returns True/False
5. Return JWT token on match, HTTP 401 on failure

**JWT token structure:**
```json
{ "sub": "<user_id>", "email": "<email>", "exp": <unix_timestamp_30_days_from_now> }
```
Signed with HS256 using `settings.auth_secret`. Expires in 30 days (set in `jwt_utils.py`).

**`get_current_user` dependency** (`auth/dependency.py`):
Called by every protected endpoint. Extracts `Authorization: Bearer <token>` header, decodes the JWT, returns `user_id` (the `sub` claim). Raises HTTP 401 if missing, expired, or tampered.

**Frontend storage** (`lib/auth-token.ts`):
Three localStorage keys are managed:
- `kb_token` — JWT access token
- `kb_email` — user email for display in sidebar
- `kb_gemini_key` — user's optional personal Gemini API key

`setToken(token)` also sets a cookie for Next.js middleware:
```js
document.cookie = `kb_token=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
// max-age = 60 * 60 * 24 * 30 = 30 days
```
`clearToken()` removes localStorage keys and expires the cookie immediately (`max-age=0`).

**`auth-context.tsx`**: React Context provider wrapping the entire app. On mount:
1. Reads `kb_token` from localStorage
2. Calls `GET /api/auth/me` to validate (token might be expired or from an old server secret)
3. If valid: sets `user` in context
4. If invalid: clears token, leaves `user` as null → middleware redirects to `/login`
Exposes: `user`, `isLoading`, `login()`, `register()`, `logout()`

**Next.js middleware** (`frontend/middleware.ts`):
Runs on every navigation except `/login` and static assets. Reads `kb_token` cookie. If absent, redirects to `/login`. This is a lightweight check (cookie read only) — real JWT validation happens on the backend per-request.

---

## 8. Document Ingestion Pipeline

### Entry point: File upload (`POST /api/upload`)

```
1. Read file bytes, validate size (≤ MAX_UPLOAD_SIZE_MB)
2. detect_source_type(filename):
   - ends with .pdf  → "pdf"
   - ends with .zip  → "obsidian"  ← Notion zips also get this initially!
   - ends with .docx → "docx"
   - ends with .pptx → "pptx"
   - ends with .xlsx → "xlsx"
   - ends with .csv  → "csv"
   - ends with .epub → "epub"
   - ends with .html / .htm → "html"
   - anything else (.md, .txt, …) → "markdown"
3. Extract doc_title from filename stem (Path(filename).stem)
4. Save file to disk: settings.upload_dir/<uuid4>_<filename>
5. crud.create_document(user_id, title, source_type, file_path=saved_path)
   → document row created with status="pending"
6. enqueue_ingestion(process_document_background(...))
   → background job queued, returns immediately
7. Return {document_id, title, source_type, status: "processing"}
```

### Entry point: URL import (`POST /api/upload/url`)

```
1. Validate URL starts with http:// or https://
2. Fetch URL with httpx (follow_redirects=True, timeout=15s, User-Agent: "Mozilla/5.0")
3. Check Content-Type is "html" or "text"
4. Extract page title from <title> tag (or use domain as fallback)
5. crud.create_document(source_type="markdown", file_path=url)
   → web pages are stored as source_type "markdown" in the DB
6. enqueue_ingestion(process_url_background(..., html_content=resp.text))
   → passes fetched HTML directly so no second fetch is needed
7. Return {document_id, title, source_type: "markdown", status: "processing"}
```

### The ingestion queue (`queue.py`)

**Why it exists:** Without serialization, two simultaneous uploads would both call `get_existing_hashes()` before either commits new chunks, see the same set of existing hashes, then both try to insert the same chunks → duplicate key violation. The queue ensures all ingestion jobs run one at a time.

**How it works:** A single asyncio `Queue` holds coroutines. A background `asyncio.Task` (`_worker`) consumes them one at a time with `await coro`. `enqueue_ingestion(coro)` puts the coroutine onto the queue. The worker runs for the lifetime of the server process.

### Parsing (`pipeline.py → parsers/`)

**`process_document_background(doc_id, file_bytes, filename, source_type, doc_title, user_id)`:**
1. `crud.update_document_status(db, doc_id, "processing")`
2. `parse_file(file_bytes, filename, source_type, doc_title)` → `list[RawChunk]`
3. If no chunks: status = "error", message = "No text could be extracted"
4. `_embed_and_store(db, doc_id, user_id, raw_chunks, doc_title)`
5. On any exception: rollback + status = "error" with exception message (truncated to 500 chars)

**`parse_file()` — format dispatch:**

| source_type | Parser | Library | Notes |
|---|---|---|---|
| "pdf" | `parsers/pdf.py` | PyMuPDF / pdfplumber / Gemini Vision | Page-by-page, vision fallback for image-heavy pages |
| "markdown" | `parsers/markdown.py` | — | UTF-8 decode, YAML frontmatter strip, `chunk_markdown` |
| "obsidian" | Detection then dispatch | zipfile | Opens zip, checks filenames to distinguish Notion vs Obsidian |
| "docx" | `parsers/docx_parser.py` | python-docx | Heading styles → `#` headers, tables → pipe tables |
| "pptx" | `parsers/pptx_parser.py` | python-pptx | Per-slide sections with title + body + speaker notes |
| "xlsx" | `parsers/spreadsheet_parser.py` | openpyxl | Each sheet → markdown table |
| "csv" | `parsers/spreadsheet_parser.py` | stdlib csv | Header + rows → markdown table |
| "epub" | `parsers/epub_parser.py` | ebooklib + BS4 | Spine-ordered chapters, strips HTML, skips short pages |
| "html" | `parsers/html_parser.py` | BS4 | Same as URL import: remove noise tags, extract text |

**Notion vs Obsidian detection (inside `parse_file` when source_type="obsidian"):**
```python
with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
    names = zf.namelist()
    is_notion = any(
        len(n.split('/')[-1].split('.')[0]) > 32  # Notion uses UUID-length filenames
        for n in names if n.endswith('.md')
    )
```
If `is_notion`: calls `notion.parse_notion_zip(file_bytes)`
Else: calls `obsidian.parse_obsidian_zip(file_bytes, doc_title)`

**Important:** The `source_type` field in the DB remains `"obsidian"` for Notion exports — the DB is never updated to reflect the actual format. This means the "Notion" filter in the UI won't find Notion exports (see Section 28).

**`process_url_background(doc_id, url, html_content, doc_title, user_id)`:**
1. If `html_content is None`: re-fetch URL with httpx (retry path for URL-sourced docs)
2. Parse with BeautifulSoup, remove noise tags:
   ```python
   for tag in soup(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
       tag.decompose()
   ```
3. Extract text with `soup.get_text(separator="\n", strip=True)`
4. Collapse 3+ consecutive newlines to 2 (`re.sub(r'\n{3,}', '\n\n', text)`)
5. `chunk_markdown(text, source_title=doc_title, source_path=url)`
6. `_embed_and_store(...)`

**`retry_document_background(doc_id, user_id, file_path, filename, source_type, doc_title)`:**
- If `file_path` starts with `http://` or `https://`: calls `process_url_background(doc_id, file_path, None, ...)` — re-fetches from URL
- Otherwise: reads file bytes from disk, calls `process_document_background(...)`
- If file is missing on disk: sets status = "error" with "Original file not found for retry"

**`_embed_and_store(db, doc_id, user_id, raw_chunks, doc_title)`:**
1. `crud.get_existing_hashes(db, user_id)` → set of content hashes for this user
2. Filter: `new_chunks = [c for c in raw_chunks if c.content_hash not in existing_hashes]`
3. If no new chunks (all duplicates): mark done with counts from `raw_chunks`, return
4. `embed_chunks(new_chunks)` → list of embeddings
5. Build `chunk_rows` list (skip chunks where embedding is None)
6. `crud.bulk_insert_chunks(db, chunk_rows)`
7. `crud.update_document_status(db, doc_id, "done", chunk_count=..., token_count=...)`

### Chunking (`chunker.py`)

**Why chunking quality matters:** The quality of retrieval depends entirely on chunk quality. Chunks that are too large dilute the semantic meaning. Chunks that cut mid-thought lose context. This is why there's a comment in the source: "CRITICAL: Do not replace this with character-count splitting."

**`chunk_markdown(text, source_title, source_path="")`:**
1. `split_by_headings(text)` — splits on `# ` and `## ` markdown headings only (H1/H2)
   - Returns list of `(heading: str, content: str)` tuples
   - If no headings found: returns `[("", text.strip())]`
2. For each `(heading, content)` section: calls `chunk_section(...)`
3. Returns flat list of all `RawChunk` objects with monotonically increasing `chunk_index`

**`chunk_section(heading, content, source_title, source_path, start_index, max_tokens=400, overlap_paragraphs=1)`:**
- If `estimate_tokens(content) ≤ 400`: one chunk with content = `f"## {heading}\n\n{content}"` (or just `content` if no heading)
- If > 400 tokens: split by paragraphs (`\n\n`), sliding window:
  - Accumulate paragraphs until window ≥ 400 tokens → flush as a chunk
  - Keep last `overlap_paragraphs=1` paragraph as start of next window (overlap for context continuity)
  - Trailing window is flushed only if > 20 words (to discard tiny fragments)

**`chunk_plain_text(text, source_title, source_path="")`:**
A simpler chunker for plain text without any headings. Uses a sliding window of paragraphs, threshold of 350 tokens, overlap of 1 paragraph. Used as a fallback in some parsers.

**`RawChunk` dataclass:**
```python
@dataclass
class RawChunk:
    content: str         # full text, includes "## heading\n\n" prefix if heading
    heading: str         # heading text stored separately for display
    source_title: str
    source_path: str
    chunk_index: int     # position within document
    page_number: Optional[int] = None  # only for PDFs

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.content.strip().encode()).hexdigest()

    @property
    def token_count(self) -> int:
        return len(self.content.split())  # word count, not subword tokens
```

### Document status lifecycle

```
pending → processing → done
                     → error (retry available)
```

Retry sets status back to `"pending"`, deletes existing chunks (`crud.delete_document_chunks`), then re-enqueues the ingestion job.

---

## 9. Embedding System

### Model
`models/gemini-embedding-001` via `google-generativeai` SDK (v1beta API endpoint). This is the only embedding model available on the v1beta endpoint; `text-embedding-004` and `embedding-001` return 404 on v1beta.

### Dimensionality
- Model outputs: 3072 dims
- We store: 768 dims (first 768 of 3072)
- Manual truncation: `result["embedding"][:EMBEDDING_DIM]`
- DB column: `vector(768)`

**Why this works (Matryoshka property):** `gemini-embedding-001` is trained with Matryoshka Representation Learning, meaning the first N dimensions of the full embedding are themselves a valid N-dimensional embedding. Truncating to 768 preserves semantic quality. We tried passing `output_dimensionality=768` to the API — it's silently ignored on v1beta. Manual truncation is the correct approach.

**Why 768 specifically:** pgvector's HNSW and IVFFlat indexes cap at 2000 dims. We chose 768 because it's a standard embedding size (same as OpenAI's small model), fits comfortably under the index limit, and the Matryoshka property guarantees validity.

### Cache versioning
Cache key prefix: `emb:v2:` for chunks, `emb_q:v2:` for queries. The `v2` suffix was bumped when the model changed from the initially attempted `text-embedding-004` (which returned 404) to `gemini-embedding-001`. This prevents stale 3072-dim cached embeddings from being served to the 768-dim pipeline.

### Task types
- Document chunks: `task_type="retrieval_document"` — tells the model this embedding will be searched against
- Queries: `task_type="retrieval_query"` — tells the model this will be used as a search query

These are meaningful hints — the model weights early dimensions differently for documents vs queries.

### `embed_chunks(chunks)` — document embedding flow
```python
BATCH_SIZE = 100  # Gemini supports up to 100 texts per batch call

for i, chunk in enumerate(chunks):
    cache_key = f"emb:v2:{chunk.content_hash}"
    cached = await cache_get(cache_key)
    if cached: embeddings[i] = json.loads(cached)
    else: uncached.append(...)

# Process uncached in batches of 100
for start in range(0, len(uncached_texts), BATCH_SIZE):
    batch = uncached_texts[start:start+BATCH_SIZE]
    embs = await run_in_executor(None, lambda b=batch: _batch_embed(b))
    # 0.3 second sleep between batches (not after last batch) — rate limit protection
    if start + BATCH_SIZE < len(uncached_texts):
        await asyncio.sleep(0.3)
    # Cache each result for 7 days (604800 seconds)
```

### `embed_queries_batch(texts)` — query embedding flow
```python
# Check cache for each query text
for i, text in enumerate(texts):
    cached = await cache_get(_query_cache_key(text))
    if cached: results[i] = json.loads(cached)
    else: uncached.append(...)

# Single batch API call for all uncached queries
try:
    new_embeddings = await run_in_executor(None, lambda: _batch_call(uncached_texts))
except Exception:
    # Fallback: embed individually in parallel (asyncio.gather)
    new_embeddings = list(await asyncio.gather(*[embed_single(t) for t in uncached_texts]))

# Cache each result for 1 hour
```

The fallback to `asyncio.gather(*[embed_single(...)])` means a batch failure gracefully degrades to individual calls rather than crashing the whole retrieval.

---

## 10. Retrieval System (RAG)

This is the core of the app. When a user asks a question, the retrieval system finds the most relevant chunks from their documents.

### Full retrieval pipeline (`retriever.py`)

```
user_message + conversation_summary + recent_user_messages
                    │
                    ▼
            build_retrieval_query()    ← enriches query with conversation context
                    │
                    ▼
            expand_query()             ← Gemini generates 3 alternative phrasings
                    │
            [original, alt1, alt2, alt3]
                    │
                    ▼
          embed_queries_batch()        ← single API call for all 4 variants
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  vector_search()          bm25_search()
  (4 parallel calls,        (1 call,
   one per embedding,        original query only)
   deduplicated by chunk ID)
        │                       │
        └───────────┬───────────┘
                    ▼
          reciprocal_rank_fusion()     ← merges both result lists by rank
                    │
                    ▼
             top_n chunks              → injected into Gemini prompt
```

### `build_retrieval_query(user_message, recent_messages, summary)` (`chat/handler.py`)

```python
context_parts = []
if summary and summary != "No prior conversation.":
    context_parts.append(summary)
for msg in (recent_messages or [])[-4:]:
    if msg.role == "user":           # only user messages, not assistant
        context_parts.append(msg.content)
context_parts.append(user_message)
return " ".join(context_parts)[-500:]  # truncate to 500 chars
```

This means follow-up questions like "what about the next chapter?" retrieve chunks related to the previous topic, not just the literal words "next chapter."

### Query expansion (`expander.py`)

```python
EXPANSION_PROMPT = """The user asked: "{query}"

Generate 3 alternative phrasings of this question that would match different ways
the same idea might be written in personal notes or documents.
Output only the 3 alternatives, one per line, no numbering, no preamble."""
```

Uses `gemini-2.0-flash`. Falls back to `[query]` alone if the API call fails. Returns `[original, alt1, alt2, alt3]`.

**Why:** Personal notes are written differently than how you'd ask a question. "What did I think about the trip?" might match "felt nervous about the journey" better if expanded to include phrasings like "my feelings about the travel experience."

### Vector search (`vector_search.py`)

```sql
SET LOCAL hnsw.ef_search = 60;   -- wider beam for better recall (default is 40)

SELECT c.id::text, c.content, c.heading, c.source_title, c.source_path,
       c.page_number, c.chunk_index,
       1 - (c.embedding <=> CAST(:embedding AS vector)) AS score
FROM chunks c
JOIN documents d ON c.document_id = d.id
WHERE c.user_id = :user_id
  AND c.embedding IS NOT NULL
  AND 1 - (c.embedding <=> CAST(:embedding AS vector)) > 0.55   -- cosine similarity threshold
  [AND d.source_type = :source_type]   -- optional filter
  [AND c.created_at >= NOW() - make_interval(days => :days)]    -- optional filter
ORDER BY c.embedding <=> CAST(:embedding AS vector)    -- ascending distance = descending similarity
LIMIT :limit   -- 15 per query variant
```

`SET LOCAL hnsw.ef_search = 60` is per-transaction; it only affects this query, not other concurrent sessions. The `0.55` threshold eliminates low-relevance chunks before they pollute the RRF scores. Results get `rank = position + 1` for use in RRF.

### BM25 search (`bm25_search.py`)

```sql
SELECT CAST(c.id AS text), c.content, c.heading, c.source_title, c.source_path,
       c.page_number, c.chunk_index,
       ts_rank_cd(c.search_vector, plainto_tsquery('english', :query)) AS score
FROM chunks c
JOIN documents d ON c.document_id = d.id
WHERE c.user_id = :user_id
  AND c.search_vector @@ plainto_tsquery('english', :query)
  [AND d.source_type = :source_type]
  [AND c.created_at >= NOW() - make_interval(days => :days)]
ORDER BY score DESC
LIMIT 20
```

`plainto_tsquery('english', ...)` — handles natural language; stemming, stop-word removal. `ts_rank_cd` — "cover density" ranking, weights chunks where query terms appear close together more highly. Only uses the original query (not expanded variants) because full-text search doesn't benefit from semantic rephrasing.

### Reciprocal Rank Fusion (`rrf.py`)

```python
def reciprocal_rank_fusion(vector_results, bm25_results, k=60, top_n=8):
    scores = {}
    for result in vector_results:
        cid = result["id"]
        scores[cid] = scores.get(cid, 0) + 1 / (k + result["rank"])
        chunk_data[cid] = result
    for result in bm25_results:
        cid = result["id"]
        scores[cid] = scores.get(cid, 0) + 1 / (k + result["rank"])
        if cid not in chunk_data:
            chunk_data[cid] = result
    # sort by RRF score descending, take top_n
```

**RRF formula:** `score(chunk) = Σ 1 / (k + rank_in_list)` where `k=60` is the standard constant.

**Why RRF over score averaging:** Vector similarity scores (0–1 cosine) and BM25 scores (unbounded float) are on different scales. RRF uses only rank position, which is scale-invariant. A chunk ranking 2nd in vector search and 3rd in BM25 scores higher than one ranking 1st in only one system.

**Deduplication in retriever.py:** The 4 vector search result lists (one per query variant) are deduplicated by chunk ID before being passed to RRF. Each chunk gets the rank from its first appearance across all variants. So the merged `flat_vector` has up to 60 unique chunks (4 variants × 15 each, minus duplicates), combined with up to 20 from BM25 in RRF.

### Filters

Both vector and BM25 search accept `source_type` and `days`. Applied at the SQL level with `WHERE` clauses — not post-hoc filtering — so they reduce the search space before any scoring.

---

## 11. Chat System

### Request flow (`api/chat.py`)

1. `POST /api/chat/send` receives `{message, conversation_id?, source_type?, days?, top_n?}`
2. Rate limit: `check_rate_limit(f"chat:{current_user_id}", max_requests=30, window_seconds=60)`
3. Empty message → HTTP 400
4. Read `X-Gemini-Key` header: `gemini_key = request.headers.get("x-gemini-key") or None`
5. If `conversation_id` provided: fetch and **verify `conv.user_id == current_user_id`** (security check, HTTP 404 if mismatch)
6. Else: `crud.create_conversation(db, current_user_id)` — new conversation
7. `top_n = max(1, min(req.top_n or 6, 20))` — server-side clamp to [1, 20]
8. Return `StreamingResponse(event_stream(), media_type="text/event-stream")` with headers:
   - `Cache-Control: no-cache`
   - `Connection: keep-alive`
   - `X-Conversation-Id: <conv_id>` — frontend reads this immediately, before any SSE data

### `stream_chat_response()` (`chat/handler.py`)

```python
async def stream_chat_response(
    db, user_id, conversation_id, user_message,
    source_type=None, days=None, top_n=6, gemini_api_key=None
) -> AsyncGenerator[str, None]:
```

Step by step:
1. `genai.configure(api_key=gemini_api_key or settings.gemini_api_key)` — user key takes priority
2. Load conversation: `conv.summary`, `is_first_message = conv.message_count == 0`
3. Load `recent = crud.get_recent_messages(db, conversation_id, limit=6)` — last 6 messages (all roles)
4. `retrieval_query = build_retrieval_query(user_message, recent, summary)`
5. **Parallel**: `chunks, all_docs = await asyncio.gather(retrieve(...), crud.get_user_documents(...))`
   — retrieve chunks and load all user docs simultaneously
6. Format system prompt with all documents + retrieved chunks + summary + recent messages
7. `crud.add_message(db, conversation_id, "user", user_message, chunk_ids=[...], filter_source_type=..., filter_days=...)`
8. `model = genai.GenerativeModel("gemini-2.5-flash", system_instruction=system)`
9. `response = await run_in_executor(None, lambda: model.generate_content(user_message, stream=True))`
   — SDK is synchronous; run in thread pool to avoid blocking the event loop
10. **Yield sources immediately** (before any tokens):
    ```python
    chunk_meta = [{"id": c["id"], "source_title": c["source_title"],
                   "heading": c.get("heading",""), "content": c["content"][:200],
                   "page_number": c.get("page_number")} for c in chunks]
    yield f"data: {json.dumps({'type': 'sources', 'sources': chunk_meta})}\n\n"
    ```
11. **Iterate tokens** (synchronously over the response object):
    ```python
    for part in response:
        if part.text:
            full_response += part.text
            yield f"data: {json.dumps({'type': 'token', 'content': part.text})}\n\n"
    ```
12. `crud.add_message(db, conversation_id, "assistant", full_response, chunk_ids=[...])`
13. **Background tasks** (non-blocking, fire-and-forget):
    - If `should_summarise(db, conversation_id)` → `asyncio.create_task(update_conversation_memory(...))`
    - If first message and no title → `asyncio.create_task(_save_title(...))`
14. `yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id})}\n\n"`

### System prompt structure (`prompts.py`)

The `SYSTEM_PROMPT` template has these sections (filled at each request):
```
[Identity + rules]
  - Answer ONLY from provided context, never from training data
  - If not in notes: say "I couldn't find anything about this in your notes"
  - Always cite sources with note title
  - Synthesize multiple notes when they cover the same topic

[Chart instructions]
  - When asked for chart/graph/visualization: output ```chart JSON blocks
  - Format specs for line/area/bar charts and pie charts
  - Must use ONLY data present in the notes

ALL DOCUMENTS IN KNOWLEDGE BASE ({doc_count} total):
{document_list}   ← every doc the user has, with source type + "(still processing)" if applicable

CONTEXT FROM YOUR NOTES:
{retrieved_chunks}  ← formatted as [1] From note: "Title > Heading (page N)"\n{content}

CONVERSATION SUMMARY:
{conversation_summary}

RECENT MESSAGES:
{recent_messages}  ← last 6 messages, formatted as ROLE: content
```

**`format_chunks_for_prompt(chunks)`:**
```python
f'[{i}] From note: "{chunk["source_title"]}{heading}{page}"\n{chunk["content"]}'
# heading = " > {chunk['heading']}" if heading exists
# page = " (page {n})" if page_number exists
# separated by "\n\n---\n\n" between chunks
```

### Conversation memory (`memory.py`)

**`should_summarise(db, conv_id)`:** Returns `True` if `conv.message_count > 0 and conv.message_count % 10 == 0` — every 10 messages.

**`update_conversation_memory(conv_id)`:** Runs in a background task with its own DB session (explicitly doesn't share the request session):
1. `crud.get_all_messages(db, conv_id)`
2. Take last 10 messages
3. Format and call `gemini-2.0-flash` with `SUMMARISATION_PROMPT`:
   ```
   Summarise this conversation. Preserve: topics asked, key facts retrieved,
   decisions or action items, open questions. Incorporate existing summary.
   Max 300 tokens. Third person past tense.
   
   EXISTING SUMMARY: {existing_summary}
   NEW MESSAGES: {new_messages}
   ```
4. If conversation has no title yet: also generate title with `TITLE_PROMPT` ("5 words or fewer") as a fallback
5. `crud.update_conversation_summary(db, conv_id, new_summary, new_title)`

### Title generation (two paths)

**Path 1** — `_save_title()` in `handler.py` (primary, faster):
- Triggered on the first message of a new conversation
- Uses `gemini-2.0-flash` with prompt: *"Generate a concise 4-7 word title for a conversation starting with this question... No quotes, no punctuation, title case, be specific"*
- Saves via `crud.rename_conversation(db, conversation_id, title)`
- Runs in background so SSE "done" fires immediately

**Path 2** — Inside `update_conversation_memory()` in `memory.py` (backup):
- Uses `TITLE_PROMPT`: *"Generate a short title (5 words or fewer)..."*
- Only runs if title is still None when memory summarisation triggers (e.g. if path 1 failed)

These two paths can produce slightly different title lengths (4-7 words vs 5 words or fewer), which is an inconsistency but harmless in practice.

---

## 12. Daily Digest

`GET /api/digest`

Reads `X-Gemini-Key` header, falls back to `settings.gemini_api_key`.

```python
async def generate_daily_digest(db, user_id, gemini_api_key=None) -> dict:
    recent_topics = await get_recent_topics(db, user_id)      # last 10 conv summaries/titles
    candidate_chunks = await get_random_chunks(db, user_id, limit=20)  # 20 random chunks
    
    if not candidate_chunks:
        return {"date": today, "items": [], "message": "Import some notes..."}
    
    # Format and call Gemini
    prompt = DIGEST_PROMPT.format(today=today, recent_topics=recent_topics,
                                   candidate_chunks=formatted)
```

**`DIGEST_PROMPT`:**
```
Today is {today}.
The user has been asking about: {recent_topics}

From the following notes, identify 3-5 that are surprisingly relevant to
what they've been thinking about. Explain WHY each is relevant right now.

CANDIDATE NOTES:
{candidate_chunks}

Format each as:
NOTE: [Title] | RELEVANCE: [1-2 sentence explanation]
```

**Response parsing:**
```python
for line in raw.split("\n"):
    if line.startswith("NOTE:") and "|" in line:
        parts = line.split("|", 1)
        title = parts[0].replace("NOTE:", "").strip()
        relevance = parts[1].replace("RELEVANCE:", "").strip()
        matching = [c for c in candidate_chunks if c["source_title"] in title]
        items.append({
            "title": title, "relevance": relevance,
            "chunk_id": matching[0]["id"] if matching else None,
            "source_title": matching[0]["source_title"] if matching else title,
        })
return {"date": today, "items": items[:5], "message": None}
```

**Error handling:**
- 429 / quota / rate → "Gemini API quota temporarily exhausted — try again in a moment."
- api_key / authentication → "Gemini API key invalid or not configured."
- Other → "Could not generate digest right now."

**Model:** `gemini-2.5-flash` — same as chat, so they share quota. Changed from `gemini-2.0-flash` to fix a bug where digest quota was exhausted while chat still worked (different models have different quota pools).

**Why random chunks:** The digest is meant to surface forgotten notes. Fetching the most semantically similar chunks would just return what you were already thinking about. Random selection + AI curation creates serendipitous connections.

---

## 13. Caching Layer (`cache/redis_client.py`)

### Redis (Upstash)
Uses Upstash Redis via its REST API (`upstash_redis` Python package). Upstash is serverless Redis — each call is an HTTP request, no persistent TCP connection.

**Why Upstash:** Standard Redis requires a persistent connection pool. Upstash's REST API avoids this complexity for a low-traffic app.

**Initialization:**
```python
_redis = Redis(url=settings.upstash_redis_rest_url,
               token=settings.upstash_redis_rest_token) if url else None
```
If `UPSTASH_REDIS_REST_URL` is not set, `_redis = None` and all operations use the memory fallback silently.

### In-memory fallback
```python
_memory_cache: dict[str, str] = {}  # module-level dict

async def cache_set(key, value, ttl_seconds=86400):
    if _redis:
        _redis.set(key, value, ex=ttl_seconds); return
    # Memory fallback: crude size limit
    if len(_memory_cache) > 5000:
        keys_to_drop = list(_memory_cache.keys())[:500]  # drop first 500 by insertion order
        for k in keys_to_drop: _memory_cache.pop(k, None)
    _memory_cache[key] = value
    # NOTE: TTL is NOT respected in memory fallback — values persist until eviction
```

**Note:** The memory fallback doesn't respect TTLs. Query embeddings are supposed to expire after 1 hour but will stay indefinitely in memory. This is acceptable for a personal app (memory is bounded by the 5000-key limit).

### Cache keys and TTLs
| Pattern | TTL | What it caches |
|---|---|---|
| `emb_q:v2:<sha256[:24]>` | 1 hour | Query embeddings (4 per chat message) |
| `emb:v2:<content_hash>` | 7 days | Document chunk embeddings |

Cache version `v2` is embedded in all keys so bumping it to `v3` would invalidate all cache entries (e.g., if you change the embedding model or dimensions again).

### Utility functions
- `cache_ping()` → True if Redis reachable, False if using memory
- `cache_backend()` → `"upstash_redis"` or `"memory"` (used by health endpoint)

---

## 14. Rate Limiting (`middleware/rate_limit.py`)

Sliding window algorithm, in-memory, thread-safe:

```python
_store: dict[str, list[float]] = defaultdict(list)
_lock = Lock()

def check_rate_limit(key, max_requests, window_seconds=60):
    now = time.time()
    cutoff = now - window_seconds
    with _lock:
        times = _store[key]
        times[:] = [t for t in times if t > cutoff]  # remove old timestamps
        if len(times) >= max_requests:
            raise HTTPException(429, f"Rate limit exceeded...")
        times.append(now)
```

**Applied limits:**
- `register:{ip}` — 5 requests / 60s per IP address
- `login:{ip}` — 10 requests / 60s per IP address
- `chat:{user_id}` — 30 requests / 60s per user ID (after auth — can't fake user ID)

**Limitation:** In-memory only. Running multiple uvicorn workers (`--workers 4`) would give each worker its own `_store` — limits would be N× the intended rate. This app runs single-worker.

---

## 15. Frontend Architecture

### App Router (Next.js 14)
All pages are client components (`"use client"` at the top). Server-side rendering is not used — the entire UI is client-rendered after auth check. Next.js provides:
- File-based routing (`/chat/[conversationId]`, `/library`, `/login`)
- `middleware.ts` for cookie-based route protection
- `process.env.NEXT_PUBLIC_BACKEND_URL` environment variable injection

### Design system
Tailwind CSS with custom design tokens in `tailwind.config.js`:
```
bg-bg-dark        #0f0f0f  page background
bg-sidebar-dark   #171717  sidebar
bg-surface-dark   #1c1c1c  cards, inputs
border-border-dark #2a2a2a borders
text-primary-dark  #f0f0f0  main text
text-secondary     #888888  muted text
text-accent / bg-accent  #7c6af7  purple accent
```

### State management philosophy
No Redux, Zustand, or other state library. All state lives in component `useState` hooks in `chat/[conversationId]/page.tsx` — the single page that owns everything. Callbacks passed down via props. Intentional for simplicity — the app has one primary view.

### TypeScript types (`types/index.ts`)
```typescript
interface Document { id, title, source_type: "obsidian"|"notion"|"pdf"|"markdown"|"docx"|"pptx"|"xlsx"|"csv"|"epub"|"html", chunk_count, token_count, status, error_message?, file_path?, created_at, updated_at? }
interface Conversation { id, title?, summary?, message_count, created_at, updated_at }
interface Message { id, role, content, retrieved_chunk_ids?, created_at }
interface Source { id, source_title, heading?, content, page_number? }
interface DigestItem { title, relevance, chunk_id?, source_title }
interface DigestResponse { date, items, message? }
interface ChatStreamEvent { type: "sources"|"token"|"done", content?, sources?, conversation_id?, title? }
interface UploadResponse { document_id, title, source_type, status }
```

### API client (`lib/api.ts`)
All REST calls go through `apiFetch<T>(path, options)`:
```typescript
function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getToken();          // from localStorage
  const geminiKey = getGeminiKey();  // from localStorage
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(geminiKey ? { "X-Gemini-Key": geminiKey } : {}),
    ...(extra as object),
  };
}
```

File uploads use a separate `uploadFile(file)` function that uses `FormData` and omits `Content-Type` (browser sets multipart boundary automatically).

---

## 16. Auth Flow (Frontend)

### Login page
Two-tab form (Sign in / Create account). After successful auth:
- `setToken(token)` — stores in localStorage + cookie
- `setStoredEmail(email)` — stores in localStorage
- `setUser(user)` in auth context
- `router.replace("/chat/new")` — navigate to app

"Quick test access" button fills `admin` / `password` (corresponds to the hardcoded backend shortcut).

### `auth-context.tsx`
Wraps the entire app. On mount:
1. Reads `kb_token` from localStorage
2. Calls `GET /api/auth/me` to validate
3. On success: `setUser({ id, email })`
4. On failure: `clearToken()` → middleware will redirect to `/login` on next navigation

`login()`: calls `POST /api/auth/login`, sets token + email on success
`register()`: calls `POST /api/auth/register`, same storage
`logout()`: `clearToken()`, `setUser(null)`, `router.push("/login")`

### Next.js middleware (`middleware.ts`)
Reads `kb_token` cookie from the incoming request. If absent or falsy, `NextResponse.redirect("/login")`. Runs before every route except `/login` and `/_next/*` static files. This is a thin check — it prevents the flash of protected content before auth context loads.

---

## 17. Chat Page — State & Data Flow

`app/chat/[conversationId]/page.tsx` is the most complex file in the codebase.

### All state
```typescript
messages          DisplayMessage[]   // all messages in current conversation
isStreaming       boolean            // controls send/stop button, disables input
showUpload        boolean            // DropZone modal visibility
activeConvId      string | undefined // current conversation ID
                                     // may differ from URL param (new chat: set from SSE "done")
sourceType        string | undefined // active source filter
daysFilter        number | undefined // active days filter
topN              number             // chunks to retrieve (default 6, UI: 3/6/9/12)
sourcePreviewDoc  Document | null    // doc open in preview modal (from source badge click)
showExportMenu    boolean            // export dropdown
messagesLoading   boolean            // skeleton loader while messages load
                                     // initialized as !!conversationId (true for real IDs)
conversations     Conversation[]     // sidebar list
conversationsLoaded boolean          // prevents flash of empty state before first fetch
```

### `DisplayMessage` interface
```typescript
interface DisplayMessage {
  id: string           // "user-<Date.now()>" or "assistant-<Date.now()>" while streaming
                       // real UUID after loading from API
  role: "user" | "assistant"
  content: string      // grows token by token during streaming
  sources?: Source[]   // populated when "sources" SSE event arrives (before tokens)
  streaming?: boolean  // true until "done" SSE event
  activeFilter?: string // source type filter active when sent
  timestamp?: string   // ISO string, set when message completes
}
```

### Key URL mechanics

`params.conversationId === "new"` → `conversationId = undefined` → new chat mode  
`params.conversationId` = a UUID → load that conversation

**`?q=` query param:** When the Digest "Ask about this" button is clicked, the URL becomes `/chat/new?q=<message>`. The chat page reads this param once on mount (`useEffect([], [])`) and calls `handleSend(q)` automatically. Then replaces the URL with `/chat/new` to prevent re-sending on refresh.

### The streaming sequence

```
User types + hits Enter
    │
handleSend(message)
    │
    ├── Create userMsg (role: "user", content: message, id: "user-<ts>")
    ├── Create assistantMsg (role: "assistant", content: "", streaming: true, id: "assistant-<ts>")
    ├── setMessages([...prev, userMsg, assistantMsg])
    ├── setIsStreaming(true)
    ├── new AbortController() → abortControllerRef.current
    │
    ▼
streamChat({...})    ← opens SSE connection via sse.ts
    │
    ├── onSources → setMessages: update last assistant message with sources array
    ├── onToken   → setMessages: append token to last assistant message content
    ├── onDone    → setMessages: set streaming=false, timestamp
    │               if new conv: setActiveConvId(convId), router.replace(`/chat/${convId}`)
    │               refreshConversations() immediately (sidebar update)
    │               setTimeout(refreshConversations, 3500) (picks up AI-generated title)
    └── onError   → setMessages: set error content, streaming=false
```

**Stop button:** Calls `abortControllerRef.current.abort()` → SSE fetch throws `AbortError` → caught silently in `streamChat` → `setIsStreaming(false)`, partial content preserved.

### `handleSourceClick` stability (the document ref pattern)

`handleSourceClick` must be stable (never change reference) to prevent `MessageList` memo from breaking. But it needs access to `documents`, which changes every 3 seconds from polling.

Solution:
```typescript
const documentsRef = useRef(documents);
useEffect(() => { documentsRef.current = documents; }, [documents]);

const handleSourceClick = useCallback((sourceTitle: string) => {
  const doc = documentsRef.current.find(
    (d) => d.title.toLowerCase() === sourceTitle.toLowerCase()
  );
  if (doc) setSourcePreviewDoc(doc);
}, []);  // ← empty deps: never gets a new reference
         //   reads fresh data via ref at call time
```

---

## 18. Streaming (SSE)

### Why SSE not WebSocket
SSE is unidirectional (server → client) over HTTP. Chat is inherently unidirectional during a response. SSE: simpler, regular HTTP POST, works through proxies/CDNs, auto-reconnects natively. WebSocket would add complexity for no benefit here.

### `streamChat()` (`lib/sse.ts`)

```typescript
export async function streamChat(options: StreamChatOptions, _retries = 1): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(geminiKey ? { "X-Gemini-Key": geminiKey } : {}),
    },
    body: JSON.stringify({ message, conversation_id, source_type, days, top_n }),
    signal,  // AbortController signal
  });

  let convId = res.headers.get("x-conversation-id") || conversationId || "";

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });  // handles multi-byte chars
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";  // last line might be incomplete

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const event = JSON.parse(line.slice(6).trim());
      // dispatch to onSources / onToken / onDone callbacks
    }
  }
}
```

**Error handling:**
- `AbortError` (user clicked Stop): caught silently, no error callback
- Network failure with retries remaining: `await new Promise(r => setTimeout(r, 1200))`, then retry once
- Network failure after retries exhausted: `onError(message)`

### FastAPI SSE format

Each SSE event is:
```
data: {"type": "sources", "sources": [...]}\n\n
data: {"type": "token", "content": "Hello"}\n\n
data: {"type": "done", "conversation_id": "uuid"}\n\n
```
The double `\n` is the SSE event delimiter. The Python `yield` in the async generator produces these strings, which FastAPI's `StreamingResponse` pushes to the client as they're generated.

---

## 19. Document Library

### `useIngestionStatus` hook (`hooks/useIngestionStatus.ts`)

```typescript
let cachedDocuments: Document[] = [];  // module-level: survives React remounts

export function useIngestionStatus(pollInterval = 3000) {
  const [documents, setDocuments] = useState<Document[]>(cachedDocuments);
  const [loading, setLoading] = useState(cachedDocuments.length === 0);

  const refresh = useCallback(async () => {
    const docs = await getDocuments();
    cachedDocuments = docs;  // update module-level cache
    setDocuments(docs);
    setLoading(false);
  }, []);

  const markProcessing = useCallback((id: string) => {
    setDocuments(prev => {
      const next = prev.map(d => d.id === id ? {...d, status: "processing"} : d);
      cachedDocuments = next;  // update cache too
      return next;
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);  // fetch on mount

  // Polling — only active while any doc is processing/pending
  useEffect(() => {
    const hasActive = documents.some(d => d.status === "processing" || d.status === "pending");
    if (!hasActive) return;  // cleanup returns nothing → no interval set
    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);  // cleanup clears interval
  }, [documents, refresh, pollInterval]);

  return { documents, loading, refresh, markProcessing };
}
```

**Module-level cache pattern:** `cachedDocuments` is a module-level variable (outside the hook). When the user navigates from `/chat` to `/library` and back, the hook remounts, but `useState(cachedDocuments)` initializes with the already-loaded data → no loading flash. Regular React state would reset to `[]` on each remount.

**`markProcessing(id)`:** Called by the retry button before the API call. Optimistically flips the document's status to `"processing"` in state and cache, so the progress bar and spinner appear instantly — not after the next 3-second poll.

### `IngestionProgress` component

Shows a top progress bar when any document is `"processing"`. The bar animates between 10% and 90% (indeterminate progress), jumps to 100% when done, then fades out after 1 second.

### Document preview modal (`DocumentPreviewModal`)

Opened from two places:
1. Clicking a document in the sidebar (any status, not just "done")
2. Clicking a source badge in a chat message (via `handleSourceClick`)

Fetches `GET /api/documents/{id}/chunks` on open. Displays chunks with:
- Client-side search (substring match on chunk content)
- Chunk metadata: heading, page number, chunk index, token count
- Status badge showing current processing state

### Retry flow

Clicking the retry button in the sidebar:
```typescript
const handleRetryDocument = useCallback(async (id: string) => {
  markProcessing(id);               // instant UI feedback
  await retryDocument(id).catch(() => {});  // POST /api/documents/{id}/retry
  refreshDocs();                    // trigger a fresh poll
}, [refreshDocs, markProcessing]);
```

The retry button is shown for both `"error"` AND `"pending"` status documents (not just error):
```tsx
{(doc.status === "error" || doc.status === "pending") && (
  <button onClick={() => handleRetryDoc(doc.id)}>Retry</button>
)}
```
This handles the case where migration 002 set documents to `"pending"` for re-embedding.

---

## 20. Charts

### How charts are generated

The system prompt tells Gemini to produce charts as fenced code blocks with language `chart`:
````
```chart
{"type": "line", "title": "...", "xKey": "period", "series": [...], "data": [...]}
```
````

`react-markdown`'s `code` component renderer checks if `language === "chart"` and renders `<ChartRenderer config={raw} />` instead of a `<code>` block.

### `ChartRenderer` component

**Important:** `ChartRenderer` is a plain function component, NOT wrapped in `memo()`. Using `memo()` on it caused a "Component is not a function" error because Recharts internally calls child components as functions during rendering — `memo()` returns an object, not a callable function. So `ChartRenderer` is the one exception to the memoization strategy.

```typescript
export default function ChartRenderer({ config: raw }: { config: string }) {
  const { config, error } = parseConfig(raw);  // JSON.parse + validation
  const [activeType, setActiveType] = useState<"line" | "bar" | "area">("line");
  const isPie = config?.type === "pie";
  // ...
}
```

**Config format:**
```json
// Cartesian charts
{
  "type": "line",
  "title": "Chart title",
  "xKey": "period",
  "series": [{"key": "value", "name": "Series label", "color": "#8b5cf6"}],
  "data": [{"period": "Jan", "value": 7}]
}

// Pie charts
{
  "type": "pie",
  "title": "Chart title",
  "nameKey": "name",
  "dataKey": "value",
  "data": [{"name": "Category", "value": 40}]
}
```

**`isAnimationActive={false}` on all primitives:**
Applied to `<Bar>`, `<Area>`, `<Line>`, `<Pie>`. This disables Recharts' entry animation (bars growing, lines drawing). Without it, any parent re-render replays the animation — visible as a flash.

### Type switcher

The pill tabs (Line / Bar / Area) are only shown for non-pie charts. Each `ChartRenderer` instance has its own `activeType` state. Switching is instant — no API call.

### Streaming placeholder

While `message.streaming === true`, chart code blocks show a "Building chart…" placeholder instead of mounting `ChartRenderer`. This prevents `JSON.parse` errors on partial JSON mid-stream and eliminates the error flash that appeared before the full JSON arrived.

### Error boundary

`AssistantMessage` wraps `ChartRenderer` in `<ErrorBoundary>`. If `parseConfig` fails or Recharts throws, the error boundary catches it and shows a styled error box, preventing the entire message from unmounting.

### Why charts don't blink (the full causal chain)

Root cause: `useIngestionStatus` polls every 3s → `documents` state changes → (without the ref fix) `handleSourceClick` gets new reference → `MessageList.memo` comparison fails → `AssistantMessage` re-renders → `ChartRenderer` re-renders → Recharts SVG redraws → visible flash.

Fix chain:
1. `MessageList` wrapped in `memo()` — only re-renders when `messages`, `onSourceClick`, `onRegenerate` props change
2. `AssistantMessage` wrapped in `memo()` — same
3. `handleSourceClick` uses `documentsRef` — reference never changes
4. `isAnimationActive={false}` — even if a re-render slips through, no animation replays

---

## 21. Filter Bar (`components/ui/FilterBar.tsx`)

**Source type options:**
```typescript
const sourceTypes = [
  { value: undefined,   label: "All Sources" },
  { value: "pdf",       label: "PDF" },
  { value: "markdown",  label: "Markdown" },
  { value: "docx",      label: "Word" },
  { value: "pptx",      label: "PowerPoint" },
  { value: "xlsx",      label: "Excel" },
  { value: "csv",       label: "CSV" },
  { value: "epub",      label: "EPUB" },
  { value: "html",      label: "HTML" },
  { value: "obsidian",  label: "Obsidian" },
  { value: "notion",    label: "Notion" },    // ⚠ won't find Notion exports (stored as "obsidian")
];
```

**Day options:** All Time / Last 7 days / Last 30 days / Last 90 days

**How it works:** The filter bar sets `sourceType` and `daysFilter` state in the parent chat page. These are passed to `streamChat()` when the next message is sent → backend `/api/chat/send` → `retrieve()` → SQL `WHERE` clauses.

**Important:** The filter applies to the **next message** only. Each `Message` row stores `filter_source_type` and `filter_days` at send time. `AssistantMessage` displays an `activeFilter` badge when hovering to show what filter was active for that response.

**Mobile:** The container has `overflow-x-auto scrollbar-none` so it scrolls horizontally without showing a scrollbar.

---

## 22. Sidebar (`components/layout/Sidebar.tsx`)

### State managed inside Sidebar
```typescript
deleteState       {label, status: "deleting"|"done"} | null  // blocking delete overlay
pendingDelete     {type: "conv"|"doc", id, label} | null     // confirm dialog data
editingConvId     string | null                               // inline rename input
editingTitle      string
editingDocId      string | null
editingDocTitle   string
optimisticTitles  Record<id, title>    // shown immediately on rename submit
optimisticDocTitles  same for docs
pinnedIds         Set<string>          // persisted in localStorage
confirmClearAll   boolean              // "clear all" confirm dialog
```

### Pinning
Client-side only — pinned IDs in `localStorage["kb_pinned_conversations"]`. Pinned conversations appear first in the list. No backend involvement.

### Optimistic rename
1. `optimisticTitles[id] = newTitle` — displayed immediately (before API call)
2. `onRenameConversation(id, title)` runs in background
3. On next conversations fetch: when `conv.title === optimisticTitles[id]`, the optimistic entry is cleared (server confirmed)
4. On API failure: optimistic title is removed, original reappears

### Delete confirm flow
1. Click trash icon → `setPendingDelete({type, id, label})`
2. Confirm modal appears with Cancel / Delete buttons
3. Click Delete → `confirmDelete()` → clears `pendingDelete` → calls `runDelete()`
4. `runDelete()` → `deleteState = {label, status: "deleting"}` → blocking overlay with spinner
5. After API resolves: `{status: "done"}` → green checkmark
6. After 2 seconds: `setDeleteState(null)` → overlay disappears

### Collapsed state
- Desktop collapsed (`collapsed=true`): width `w-16`, icon-only buttons
- Desktop expanded: width `w-72`, full labels
- Mobile: uses `mobileOpen` prop — `w-0` (hidden) or `w-72` (open)
- `showIconOnly = !isMobile && collapsed`

### Document click behaviour
Documents can be clicked to open preview modal **regardless of status** (not just when `"done"`). This was changed from the original `status === "done"` restriction to allow previewing partially processed documents.

---

## 23. Gemini API Key Override

### Problem
Gemini free-tier quota is shared across all app users. Heavy use exhausts it. Users get errors on chat and digest.

### Architecture decision: client-side key, sent per-request
The key is stored in `localStorage["kb_gemini_key"]`. It is **never** sent to the application server as a stored credential. Every request that calls Gemini includes `X-Gemini-Key: <key>` as an HTTP header. The backend reads it per-request and passes it directly to `genai.configure(api_key=...)` before the Gemini call. If absent, the env key is used.

Benefits:
- No server-side secret storage of user keys
- Key is visible only in HTTPS headers (encrypted in transit)
- User can clear it anytime via "Remove key" button
- Zero backend changes needed for storage/retrieval

### Full flow
1. User opens sidebar → clicks "API Key" button
2. `GeminiKeyModal` opens — shows password input, quota explanation, link to Google AI Studio
3. User pastes `AIza...` key → clicks Save → `setGeminiKey(key)` (localStorage) → modal closes
4. Every subsequent `api.ts` call: `authHeaders()` includes `"X-Gemini-Key": geminiKey`
5. Every SSE call in `sse.ts`: manually adds same header
6. Backend `api/chat.py`: `gemini_key = request.headers.get("x-gemini-key") or None`
7. `stream_chat_response(..., gemini_api_key=gemini_key)` → `genai.configure(api_key=gemini_key or settings.gemini_api_key)`
8. Same pattern in `api/digest.py` → `generate_daily_digest(..., gemini_api_key=gemini_key)`

### `GeminiKeyModal` UI details
- Input `type="password"` — key not shown in plain text
- "Active" label (green) when a saved key exists
- "Remove key" button when a key exists
- After saving: shows green checkmark for 800ms, then `setTimeout(onClose, 800)`
- Link to `https://aistudio.google.com/app/api-keys` for getting a key free

---

## 24. Export (Markdown & PDF)

### Markdown export (`exportConversationAsMarkdown`)
```
# {title}
*Exported on {date}*
---
**You**
{user message content}
---
**Assistant**
{assistant message content}
---
```
Downloaded as `{title_slug}_{date}.md` via `URL.createObjectURL(blob)` + a hidden `<a>` click + `URL.revokeObjectURL`.

### PDF export (`exportConversationAsPDF`)
Uses **jsPDF** — a client-side JavaScript PDF library. No browser print dialog, no server involvement.

```typescript
const { default: jsPDF } = await import("jspdf");  // dynamically imported (not in initial bundle)
const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
```

**PDF structure:**
- **Header bar:** 28mm tall dark purple rectangle (`#181460` fill), conversation title in purple-tinted text, "Knowledge Base · Exported {date}" subtitle
- **Messages:** Each message has a colored role label pill (purple for user, dark for assistant), optional timestamp, then plain text content
- **Separator:** Light purple horizontal line between messages
- **Footer:** "Knowledge Base" left + "Page N of M" right on every page

**Markdown stripping (`stripMarkdown`):**
```typescript
// Code blocks → [Code]\ncontent
// Inline code, bold, italic, underline → plain text
// Headings → remove ## prefix
// Links → just the link text
// Bullets → • prefix
```
This conversion is needed because jsPDF renders plain text only; markdown syntax would appear literally.

**Text layout:** `doc.splitTextToSize(text, contentW - indent)` wraps text to page width. `addPageIfNeeded(needed)` checks if `y + needed > pageH - margin` and adds a new page if so.

Downloaded as `{title_slug}_{date}.pdf` via `doc.save(filename)`.

---

## 25. Database Migrations (Alembic)

### Overview
Alembic is the Python database migration framework. Migrations live in `backend/alembic/versions/`. Each migration is reversible (has `upgrade()` and `downgrade()`).

**Run migrations:**
```bash
cd backend
alembic upgrade head    # apply all pending migrations
alembic stamp 001       # mark current DB as at migration 001 (for existing DBs)
alembic downgrade -1    # revert one migration
```

### Migration 001 — Initial Schema (`001_initial_schema.py`)

**Purpose:** Baseline schema for the live database. Created retroactively when Alembic was introduced. Designed to be safe on an already-running database (all statements use `IF NOT EXISTS`).

```sql
CREATE EXTENSION IF NOT EXISTS vector;    -- pgvector
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (...)
CREATE TABLE IF NOT EXISTS documents (...)
CREATE TABLE IF NOT EXISTS chunks (
    ...
    embedding vector(3072)    -- original dimension before migration 002
)
CREATE TABLE IF NOT EXISTS conversations (...)
CREATE TABLE IF NOT EXISTS messages (...)
```

**After running on an existing DB:**
```bash
alembic stamp 001  # if tables already exist, just mark as at this revision
```

### Migration 002 — Embedding Dimension Reduction (`002_embedding_768dim.py`)

**Purpose:** Shrink `chunks.embedding` from `vector(3072)` to `vector(768)` so the HNSW index can be created (pgvector indexes cap at 2000 dims).

```sql
ALTER TABLE chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE chunks ADD COLUMN embedding vector(768);

-- Drop stale index names from old schema
DROP INDEX IF EXISTS chunks_embedding_idx;
DROP INDEX IF EXISTS chunks_embedding_hnsw_idx;
DROP INDEX IF EXISTS chunks_embedding_ivfflat_idx;

-- Create HNSW index (now within 2000-dim limit)
CREATE INDEX chunks_embedding_hnsw_idx
ON chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Reset all docs so the ingestion queue re-embeds them at 768 dims
UPDATE documents SET status = 'pending', error_message = NULL
WHERE status IN ('done', 'error');
```

**What happens after running this migration:**
1. All existing 3072-dim embeddings are gone (column dropped)
2. All documents set to `"pending"` — they need to be re-embedded
3. Server startup: `reset_stuck_documents()` detects `pending` docs with `chunk_count > 0`, sets them to `"error"` so users see the retry button
4. User clicks retry on each document → re-ingestion at 768 dims

**Downgrade:** Drops the 768-dim column, adds back `vector(3072)`, drops HNSW index, resets all docs to `"pending"`.

---

## 26. Operational Infrastructure

### GitHub Actions — Keep Supabase Alive (`.github/workflows/keep_supabase_alive.yml`)

**Problem:** Supabase free-tier projects pause automatically after 1 week of inactivity. A paused project refuses all connections until manually unpaused via the dashboard.

**Solution:** A GitHub Action pings the Supabase REST API every 6 hours.

```yaml
on:
  schedule:
    - cron: "0 0 */6 * *"    # every 6 hours at minute 0
  workflow_dispatch:           # can also be triggered manually from GitHub UI

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase
        run: |
          curl -s -o /dev/null -w "%{http_code}" \
            "${{ secrets.SUPABASE_URL }}/rest/v1/" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

**Required GitHub secrets:** `SUPABASE_URL` and `SUPABASE_ANON_KEY` (not the service role key — the anon key is safe for pinging).

**Why `SUPABASE_ANON_KEY` and not the service key:** The ping only needs to hit any REST endpoint; the anon key is sufficient and less risky to expose in CI logs.

---

## 27. Performance Decisions

### `asyncio.get_event_loop().run_in_executor(None, lambda: ...)`
The Gemini Python SDK (`google-generativeai`) is synchronous. Calling it directly in an async FastAPI handler blocks the event loop, freezing all other concurrent requests. `run_in_executor(None, ...)` runs the call in the default ThreadPoolExecutor, yielding the event loop while waiting. Used for: `model.generate_content(...)`, `genai.embed_content(...)`.

### `asyncio.gather` for parallel operations
In `stream_chat_response`:
```python
chunks, all_docs = await asyncio.gather(
    retrieve(db, user_id, retrieval_query, ...),
    crud.get_user_documents(db, user_id),
)
```
Retrieval (query expansion → embedding → vector+BM25 search) and document listing run concurrently. Since retrieval involves multiple Gemini API calls, this saves meaningful latency.

### Why conversations are refreshed twice with `setTimeout`
```typescript
refreshConversations();
setTimeout(refreshConversations, 3500);
```
The first call updates the sidebar immediately. The second, 3.5 seconds later, picks up the AI-generated title (which is generated as a background task and takes 1-3 seconds). Without the second call, the sidebar shows "Untitled conversation" for a while after the first exchange.

### Single-worker ingestion queue
Processing one job at a time prevents the duplicate-hash race (two uploads seeing the same existing hashes before either commits). Performance cost is minimal — ingestion is I/O-bound (Gemini API calls take seconds), so serialization doesn't create CPU saturation.

### `memo()` on `MessageList` and `AssistantMessage`
Every time `useIngestionStatus` returns new data (every 3 seconds), the chat page re-renders. Without memoization, all messages would re-render, causing Recharts to redraw charts. `React.memo` does a shallow prop comparison and bails out when props are unchanged.

### Batch embedding (100 texts per API call)
`embed_queries_batch()` sends all 4 query variants in one `embed_content(content=[...])` call — one API round-trip instead of four. `embed_chunks()` also batches up to 100 chunks per call. The Gemini API supports up to 100 texts per batch.

### 0.3s inter-batch sleep in `embed_chunks`
When embedding more than 100 chunks (large documents), there's a 0.3 second sleep between batches. This is rate-limit protection for the Gemini embedding API, which has per-minute request limits.

### `messagesLoading` initialization prevents content flash
```typescript
const [messagesLoading, setMessagesLoading] = useState(!!conversationId);
// !!conversationId = true for /chat/<uuid>, false for /chat/new
```
For a real conversation ID: start as true (skeleton visible immediately) → fetch messages → setLoading(false). Without this, the initial `false` would briefly show the empty/home state before the skeleton appeared.

### Module-level `cachedDocuments` in `useIngestionStatus`
Persists across React remounts (navigating away and back). Instant data on return — no loading flash. Regular `useState([])` would reset to empty on remount.

---

## 28. Known Limitations & Bugs

1. **Notion "filter" doesn't work.** `detect_source_type()` assigns `source_type="obsidian"` to ALL zip uploads. Notion exports (which are also zips) get stored as "obsidian" in the DB. Selecting "Notion" in the filter bar sends `source_type="notion"` to the SQL query, which matches nothing. Fix: update `source_type` after the Notion/Obsidian detection in `parse_file()`.

2. **Single-process rate limiting.** The in-memory rate limiter uses module-level state. Running multiple uvicorn workers (`--workers N`) would give each worker its own bucket — effective limit becomes `N × max_requests`. The app is designed for single-worker deployment.

3. **Single-process ingestion queue.** Same limitation. Multiple workers would each have their own queue, reintroducing the duplicate-hash race condition on concurrent uploads.

4. **Gemini free tier quota is shared.** All app users draw from the same API key's quota. Mitigated by the user API key feature (Section 23).

5. **Approximate token counting.** `estimate_tokens(text) = len(text.split())` counts words, not actual subword tokens. Actual Gemini token count can be 1.2–1.5× word count depending on vocabulary. This means chunks can be slightly larger than 400 "tokens" in reality. Harmless for chunking decisions but don't use this for billing calculations.

6. **No document-level deduplication.** Uploading the same PDF twice creates two document rows. Chunk-level deduplication (via `content_hash`) means the actual text isn't doubled in the vector DB, but the document list shows it twice.

7. **Hardcoded `admin` / `password` test account.** `backend/app/api/auth.py` lines 61–67. Remove before sharing with anyone outside local dev.

8. **Memory cache TTL not enforced.** The in-memory fallback for Redis doesn't respect the `ttl_seconds` parameter. Query embeddings are supposed to expire after 1 hour but will persist until eviction (> 5000 entries). Rarely matters in practice.

9. **`search_conversations` is `ILIKE`-only.** No vector search, no relevance ranking. Searches title, summary, and message content with `ILIKE %query%`. Won't match synonyms or paraphrases.

10. **`X-Conversation-Id` header read timing.** In `sse.ts`, `convId` is read from the response header before the SSE body is consumed. This works correctly but relies on the header being available before `ReadableStream` consumption begins — which it always is in HTTP/1.1 but worth knowing.

---

## 29. Environment Variables Reference

All read from `backend/.env` via `pydantic-settings` `BaseSettings`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | — | Default Google Gemini API key (used when no user key supplied) |
| `DATABASE_URL` | Yes | — | asyncpg PostgreSQL connection URL (e.g. `postgresql+asyncpg://user:pass@host/db`) |
| `SUPABASE_URL` | Yes | — | Supabase project URL (used for GitHub Action ping + Supabase client) |
| `SUPABASE_SERVICE_KEY` | Yes | — | Supabase service role key (bypasses Row Level Security) |
| `SUPABASE_STORAGE_BUCKET` | No | `knowledge-base-files` | Supabase storage bucket name |
| `UPSTASH_REDIS_REST_URL` | No | — | Upstash Redis REST endpoint. If absent, falls back to memory cache |
| `UPSTASH_REDIS_REST_TOKEN` | No | — | Upstash auth token |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated CORS origins |
| `MAX_UPLOAD_SIZE_MB` | No | `50` | Max file upload size in megabytes |
| `UPLOAD_DIR` | No | `./uploads` | Directory where uploaded files are saved on disk |
| `AUTH_SECRET` | Yes | — | JWT signing secret (HS256). Must be ≥32 random bytes in production |

Frontend (`.env.local`):
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Backend URL. Defaults to `http://localhost:8000` if absent |

GitHub Actions secrets (repository Settings → Secrets):
| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL (same value as backend env) |
| `SUPABASE_ANON_KEY` | Supabase anon (public) key — sufficient for the ping endpoint |

---

## 30. API Endpoint Reference

### Auth (`/api/auth`)
| Method | Path | Auth | Rate limit | Description |
|---|---|---|---|---|
| POST | `/api/auth/register` | No | 5/min per IP | Create account. Body: `{email, password}`. Returns `{access_token, token_type, user}` |
| POST | `/api/auth/login` | No | 10/min per IP | Get token. Body: `{email, password}`. Returns same shape |
| GET | `/api/auth/me` | Yes | — | Validate token. Returns `{status: "ok", user_id}` |

### Documents (`/api/documents`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/documents` | Yes | List all user documents, ordered by `created_at` desc |
| GET | `/api/documents/{id}` | Yes | Single document detail |
| GET | `/api/documents/{id}/chunks` | Yes | Document + all its chunks (for preview modal) |
| PATCH | `/api/documents/{id}` | Yes | Rename. Body: `{title}` |
| DELETE | `/api/documents/{id}` | Yes | Delete document and all its chunks (CASCADE) |
| POST | `/api/documents/{id}/retry` | Yes | Delete chunks, reset status, re-queue ingestion |

### Upload (`/api/upload`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/upload` | Yes | Multipart file upload. Returns `{document_id, title, source_type, status}` |
| POST | `/api/upload/url` | Yes | Import from URL. Body: `{url}`. Returns same shape |

### Chat (`/api/chat`)
| Method | Path | Auth | Rate limit | Description |
|---|---|---|---|---|
| POST | `/api/chat/send` | Yes | 30/min per user | Send message. Returns SSE stream. Body: `{message, conversation_id?, source_type?, days?, top_n?}` |
| GET | `/api/chat/conversations` | Yes | — | List all user conversations (limit 50, desc by updated_at) |
| DELETE | `/api/chat/conversations` | Yes | — | Delete ALL user conversations |
| GET | `/api/chat/conversations/{id}/messages` | Yes | — | All messages in a conversation (asc by created_at) |
| PATCH | `/api/chat/conversations/{id}` | Yes | — | Rename conversation. Body: `{title}` |
| DELETE | `/api/chat/conversations/{id}` | Yes | — | Delete single conversation |
| GET | `/api/chat/search?q={query}` | Yes | — | Two-stage search: title/summary ILIKE, then message content ILIKE |

### Digest & Health
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/digest` | Yes | Generate daily digest. Reads `X-Gemini-Key` header |
| GET | `/api/health` | No | Server health check |

### SSE event types (from `/api/chat/send`)
```json
{"type": "sources", "sources": [{"id": "...", "source_title": "...", "heading": "...", "content": "...(200 chars)", "page_number": null}]}
{"type": "token", "content": "Hello"}
{"type": "done", "conversation_id": "uuid"}
```
The `X-Conversation-Id` response header contains the conversation ID and is available before any SSE data.

### Conversation search detail (`/api/chat/search`)
Two-stage ILIKE search in `crud.search_conversations`:
```
Stage 1: WHERE (title ILIKE %q% OR summary ILIKE %q%) ORDER BY updated_at DESC LIMIT 15
Stage 2: If stage 1 returned < 15 results:
  JOIN messages WHERE message.content ILIKE %q%
  AND conversation.id NOT IN (stage 1 IDs)
  DISTINCT, ORDER BY updated_at DESC, LIMIT (15 - stage1_count)
```
Results from both stages are combined. Note: case-insensitive string match only, no relevance ranking.

---

## 31. Data Flow Diagrams

### Upload flow
```
Browser                     FastAPI                    Disk       PostgreSQL     Gemini
  │                            │                         │             │             │
  │──POST /api/upload ────────>│                         │             │             │
  │  (multipart file)          │── save file ───────────>│             │             │
  │                            │── INSERT document ───────────────────>│             │
  │<── {doc_id, "processing"}──│   status="pending"                    │             │
  │                            │                                       │             │
  │                            │   [background, via queue]             │             │
  │                            │── UPDATE status ──────────────────────>│             │
  │                            │   ="processing"                       │             │
  │                            │── parse (PDF/MD/zip)                  │             │
  │                            │── chunk_markdown()                    │             │
  │                            │── check existing hashes ──────────────>│             │
  │                            │──────────────────────────────────────────────embed()─>│
  │                            │<──────────────────────────────────────────[768-dim]──│
  │                            │── INSERT chunks ──────────────────────>│             │
  │                            │── UPDATE status ──────────────────────>│             │
  │                            │   ="done"                              │             │
  │                            │                                       │             │
  │──GET /api/documents ──────>│── SELECT documents ───────────────────>│             │
  │<── [{status:"done",...}] ──│                                       │             │
```

### Chat message flow
```
Browser              FastAPI                PostgreSQL          Gemini
  │                     │                       │                 │
  │──POST /chat/send──>│                       │                 │
  │  X-Gemini-Key: ?   │── GET conv + msgs ───>│                 │
  │                     │── genai.configure()   │                 │
  │                     │                       │──expand_query()─>│ (gemini-2.0-flash)
  │                     │                       │<──[3 variants]──│
  │                     │                       │──embed_queries()─>│ (gemini-embedding-001)
  │                     │                       │<──[4 embeddings]─│
  │                     │── vector_search(×4) ──>│                 │
  │                     │── bm25_search(×1) ────>│                 │
  │                     │── RRF merge            │                 │
  │                     │── get_user_documents ──>│                 │
  │                     │── INSERT user msg ─────>│                 │
  │                     │                       │                 │
  │<── X-Conversation-Id header                  │                 │
  │<── sources event ───│                       │──generate(stream=True)─>│ (gemini-2.5-flash)
  │<── token events ────│<────────────────────────────────────────│<──[token stream]──│
  │    (streaming)      │                       │                 │
  │<── done event ──────│── INSERT asst msg ────>│                 │
  │                     │                       │                 │
  │                     │   [background tasks, non-blocking]       │
  │                     │── title: _save_title() ─────────────────>│ (gemini-2.0-flash)
  │                     │── memory: update_conversation_memory() ──>│ (gemini-2.0-flash)
  │                     │   (if message_count % 10 == 0)           │
```

### Retrieval detail
```
query + last 4 user msgs + conversation summary
      │
      ▼
build_retrieval_query()     → enriched_query (≤500 chars)
      │
      ▼
expand_query(enriched)      → [original, alt1, alt2, alt3]  (gemini-2.0-flash)
      │
      ▼
embed_queries_batch([...])  → [emb0, emb1, emb2, emb3]   (one API call → cache)
      │
      ├──vector_search(emb0, limit=15)─┐
      ├──vector_search(emb1, limit=15)─┤ asyncio.gather (parallel)
      ├──vector_search(emb2, limit=15)─┤ deduplicate by chunk ID
      └──vector_search(emb3, limit=15)─┘ → flat_vector (≤60 unique chunks)
      │
      └──bm25_search(original, limit=20) → bm25_results (≤20 chunks)
      │
      ▼
reciprocal_rank_fusion(flat_vector, bm25_results, k=60, top_n=6)
      │
      ▼
top 6 chunks → formatted as [N] From note: "Title > Heading" → system prompt → Gemini → SSE tokens
```

### Embedding cache flow
```
embed_queries_batch([q0, q1, q2, q3])
      │
      ├── cache_get("emb_q:v2:<sha256(q0)>") → hit/miss
      ├── cache_get("emb_q:v2:<sha256(q1)>") → hit/miss
      ├── cache_get("emb_q:v2:<sha256(q2)>") → hit/miss
      └── cache_get("emb_q:v2:<sha256(q3)>") → hit/miss
            │
            ▼ (only uncached queries)
      genai.embed_content(model=gemini-embedding-001, content=[uncached], task_type="retrieval_query")
            │
            ▼
      result["embedding"] → [e[:768] for e in embs]   ← manual 3072→768 truncation
            │
            ▼
      cache_set(key, json.dumps(embedding), ttl_seconds=3600)   ← 1 hour TTL
```

---

*This document covers every file, every function signature of consequence, every design decision and its reasoning, every known limitation, and every data flow path. Read this once, own the codebase.*

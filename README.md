# Knowledge Base

Chat with your own notes. Import Obsidian vaults, Notion exports, PDFs, Word docs, PowerPoint decks, spreadsheets, EPUBs, HTML, or plain markdown — then ask questions in natural language. Answers come **strictly** from your documents, with inline citations to the exact chunk.

**Live demo:** [sv-knowledge-base.vercel.app](https://sv-knowledge-base.vercel.app) — click *Try the demo* on the login page to land in a pre-seeded chat with three documents about Shankar V (the author of this project). No signup needed.

---

## Why it exists

LLMs hallucinate when they don't know. RAG systems usually still hallucinate — they retrieve a few chunks and let the model fill the gaps with its training data. This system is built around one rule: **if the answer isn't in the retrieved chunks, the model says so.** Every response cites the source chunk by ID. Every citation links back to the document in a side panel.

The other design priority is retrieval quality. A naive vector search returns "topically related" chunks that often miss the exact answer. This system combines vector similarity with PostgreSQL full-text keyword search (`tsvector`), fuses them with Reciprocal Rank Fusion, and expands the query into three semantic variants before retrieving — which materially improves recall on short or ambiguous questions.

---

## What it does

- **Multi-format ingestion**: Obsidian (.zip vault), Notion (.zip export), PDF, DOCX, PPTX, XLSX, CSV, EPUB, HTML, markdown, plain text.
- **Heading-aware chunking**: splits at markdown heading boundaries (not arbitrary character counts), preserving document structure.
- **Hybrid retrieval**: pgvector ANN + PostgreSQL `tsvector` full-text search + Reciprocal Rank Fusion.
- **Query expansion**: each user question is rewritten into 3 semantic variants for broader recall.
- **Streaming chat**: token-by-token over Server-Sent Events. Sources arrive first so citation badges render immediately.
- **Conversation memory**: rolling summary every 10 messages keeps long chats coherent without blowing up the context window.
- **Daily digest**: surfaces notes from your history that are relevant to what you're working on today.
- **Demo mode**: one-click public demo account pre-seeded with sample documents.
- **Bring Your Own Key**: when the shared free-tier Gemini quota runs out, users can paste their own free key (stored only in their browser).
- **Resilient startup**: app boots even if Supabase is paused; recovers automatically when DB is reachable again.

---

## Architecture

### Ingestion pipeline

```
File upload
    │
    ▼
┌─────────────────┐    detect format from extension
│ Source detection│─── (.pdf, .zip → Obsidian/Notion,
└─────────────────┘     .docx, .pptx, .xlsx, .epub,
    │                   .html, .md, plain text)
    ▼
┌─────────────────┐
│ Format parser   │    extract text + heading structure
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Heading-aware   │    split at H1/H2 boundaries
│   chunker       │    (preserves logical document structure)
└─────────────────┘
    │
    ▼
┌─────────────────┐    deduplicate via content_hash
│  Dedup + embed  │    embed in batches (Gemini)
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Bulk insert    │    chunks + embeddings → Supabase
└─────────────────┘    pgvector + tsvector indexes
```

Ingestion runs through a single-worker async queue (`app/ingestion/queue.py`) to prevent concurrent uploads from racing on `get_existing_hashes` and inserting duplicate chunks.

### Retrieval pipeline

```
User question
    │
    ▼
┌──────────────────┐
│ Query expansion  │   Gemini → 3 alternate phrasings
└──────────────────┘   (falls back to original on failure)
    │
    ▼
┌──────────────────┐          ┌──────────────────┐
│  pgvector ANN    │          │  Full-text search│
│  (cosine sim)    │          │  (tsvector,      │
│                  │          │   ts_rank_cd)    │
└──────────────────┘          └──────────────────┘
        │                              │
        └───────────┬──────────────────┘
                    ▼
         ┌─────────────────────┐
         │ Reciprocal Rank     │   k=60, top_n per filter
         │  Fusion (RRF)       │
         └─────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │  Optional filters   │   source_type, days
         └─────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │  Top-N chunks to    │   passed to chat handler
         │   chat context      │
         └─────────────────────┘
```

### Chat pipeline

```
User message
    │
    ▼
┌──────────────────┐    Retrieve top-N chunks
│   Retrieval      │    (hybrid + query expansion)
└──────────────────┘
    │
    ▼
┌──────────────────┐    last summary + last 6 messages
│  Memory load     │    (rolling summary refreshed every 10 turns)
└──────────────────┘
    │
    ▼
┌──────────────────┐    chunks + memory + question
│  Prompt assembly │    + system instruction
└──────────────────┘    ("answer ONLY from chunks")
    │
    ▼
┌──────────────────┐    Gemini stream → SSE
│  Generation      │    sources first, then tokens
└──────────────────┘
    │
    ▼
┌──────────────────┐    if turn count is divisible by 10
│  Memory update   │    summarise history in background
└──────────────────┘
```

---

## Tech stack

| Layer        | Technology                                                  |
| ------------ | ----------------------------------------------------------- |
| Chat LLM     | Google Gemini 2.0 Flash                                     |
| Embeddings   | `gemini-embedding-001` (3072-dim output truncated to 768)   |
| Vector DB    | Supabase Postgres + pgvector (HNSW cosine index)            |
| Full-text    | PostgreSQL `tsvector` (`plainto_tsquery` + `ts_rank_cd`)    |
| Fusion       | Reciprocal Rank Fusion (RRF, k=60)                          |
| Cache        | Upstash Redis (REST) with in-memory fallback                |
| Backend      | FastAPI · Python 3.11 · SQLAlchemy 2 (async) · asyncpg      |
| Auth         | Custom JWT (bcrypt password hashing) + demo account         |
| Frontend     | Next.js 14 (App Router) · React 18 · TypeScript             |
| Styling      | Tailwind CSS · Framer Motion                                |
| Streaming    | Server-Sent Events (fetch + ReadableStream)                 |
| Deployment   | Render (backend) · Vercel (frontend)                        |

---

## Supported file formats

| Format          | Extension       | Parser                              |
| --------------- | --------------- | ----------------------------------- |
| Obsidian vault  | `.zip`          | Walks `.md` files, preserves links  |
| Notion export   | `.zip`          | Detected by long UUID filenames     |
| PDF             | `.pdf`          | Text extraction + per-page metadata |
| Word            | `.docx`         | python-docx                         |
| PowerPoint      | `.pptx`         | One chunk per slide                 |
| Spreadsheet     | `.xlsx`, `.csv` | One chunk per sheet/section        |
| EPUB            | `.epub`         | Chapter-level chunking              |
| HTML            | `.html`, `.htm` | BeautifulSoup, strips chrome        |
| Markdown / text | `.md`, `.txt`   | Heading-aware                       |
| URLs            | (paste)         | Fetched + BeautifulSoup extraction  |

---

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm (or pnpm)
- A free Supabase project (with the `vector` extension enabled)
- A free Google AI Studio API key for Gemini
- A free Upstash Redis instance (optional — falls back to in-memory)

### 1. Database setup

In your Supabase SQL Editor, enable the required extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

The application creates its own schema (users, documents, chunks, conversations, messages) idempotently on startup via `app/db/ensure_indexes.py`.

### 2. Clone and configure

```bash
git clone https://github.com/ShankarV-xD/knowledge-base.git
cd knowledge-base
```

### 3. Backend env (`backend/.env`)

```env
GEMINI_API_KEY=your_gemini_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
DATABASE_URL=postgresql+asyncpg://postgres:[password]@db.[ref].supabase.co:5432/postgres
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
ALLOWED_ORIGINS=http://localhost:3000
AUTH_SECRET=generate_a_long_random_string_here
ENABLE_DEMO_LOGIN=true
DEMO_EMAIL=demo@knowledge-base.app
```

Generate a strong `AUTH_SECRET`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 4. Frontend env (`frontend/.env.local`)

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### 5. Install and run

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). The demo user is seeded automatically on first boot.

---

## Project structure

```
backend/
  app/
    api/             FastAPI routers
      auth.py        ── register / login / demo-login / me
      upload.py      ── file + URL ingestion
      chat.py        ── streaming chat
      documents.py   ── list, rename, delete, retry
      digest.py      ── daily digest endpoint
      share.py       ── public share links for conversations
      health.py      ── /health (touches DB) and /ping (lightweight)
    ingestion/
      pipeline.py    ── orchestrates parse → chunk → embed → store
      chunker.py     ── heading-aware splitting
      embedder.py    ── batched Gemini embeddings
      queue.py       ── single-worker serialised ingestion
      parsers/       ── one module per file format
    retrieval/
      retriever.py   ── orchestrates vector + full-text + RRF
      vector_search.py ── pgvector cosine ANN
      bm25_search.py ── PostgreSQL full-text (tsvector) search
      rrf.py         ── Reciprocal Rank Fusion
      expander.py    ── query expansion via Gemini
    chat/
      handler.py     ── streaming generation, source-first SSE
      memory.py      ── rolling-summary conversation memory
    digest/
      daily.py       ── relevance-ranked recent-notes digest
    db/
      models.py      ── SQLAlchemy ORM models
      crud.py        ── async CRUD helpers
      client.py      ── async engine + session factory
      ensure_indexes.py ── idempotent schema setup
    auth/
      jwt_utils.py   ── access token creation / validation
      dependency.py  ── FastAPI dependency for current user
    cache/
      redis_client.py ── Upstash REST + in-memory fallback
    middleware/
      rate_limit.py   ── per-IP rate limiting
    seeder.py        ── seeds demo user with sample docs on boot
    config.py        ── Pydantic settings
    main.py          ── app entrypoint, lifespan
  seed_data/         ── markdown files ingested for the demo user
  requirements.txt

frontend/
  app/
    page.tsx                              Landing
    login/page.tsx                        Login + register + demo
    chat/[conversationId]/page.tsx        Main chat experience
    library/page.tsx                      Document browser
    share/[token]/page.tsx                Read-only shared conversations
    layout.tsx                            Root layout
    icon.svg                              Browser favicon
  components/
    chat/             MessageList, ChatInput, source rendering
    upload/           DropZone, IngestionProgress
    library/          DocumentPreviewModal
    ui/               GeminiKeyModal, FilterBar, etc.
    layout/           AppShell, Sidebar
  lib/
    api.ts            REST wrappers
    sse.ts            Streaming chat client
    auth-context.tsx  Auth provider + token storage
    auth-token.ts     localStorage helpers (auth + Gemini key)
  hooks/
    useIngestionStatus.ts
  types/index.ts
```

---

## Demo mode

The application ships with a "Try the demo" button on the login page that issues a token for a shared demo user. The demo user is pre-seeded with three markdown documents about the project's author (Shankar V), so visitors land in a chat-ready state instead of an empty workspace.

For the demo user only, the new-chat screen shows six recruiter-oriented suggestion buttons that auto-submit common questions. Hidden for any other user, hidden once a conversation has started.

Demo behaviour is controlled by `ENABLE_DEMO_LOGIN` and `DEMO_EMAIL` in `backend/.env`. Disable for self-hosted deployments where you don't want public access.

---

## Resilience

The app is designed to keep running through failures of its dependencies:

- **Supabase paused** — startup catches DB errors, app boots in degraded state, `/health` returns `degraded` but `/ping` stays green. Once Supabase is restored, requests recover automatically.
- **Redis unreachable** — cache layer falls back to a process-local `dict`. Slower, but functional.
- **Gemini quota exhausted** — chat handler detects `429` / `resource_exhausted` errors and emits a `quota_exceeded` SSE event. The frontend auto-opens the BYOK modal so the user can paste their own free Gemini key in one click.
- **Pre-existing failures don't compound** — `reset_stuck_documents` runs on startup to mark any documents stuck in `processing` from a crashed previous run as `error` (retryable).

---

## Deployment

The repo includes a `Dockerfile` for the backend. Frontend deploys to Vercel as standard Next.js.

```bash
# Backend → Render / Fly.io
docker build -t knowledge-base ./backend
# (deploy according to your platform)

# Frontend → Vercel
vercel --prod
```

Set `NEXT_PUBLIC_BACKEND_URL` in Vercel to the deployed backend URL.

### Keeping it warm

Render and similar free tiers sleep services after idle periods, and Supabase pauses projects after 7 days of inactivity. Both are solved with an external monitor (UptimeRobot is free) hitting `/health` every 5 minutes — that endpoint touches the DB, which keeps the server warm and Supabase from auto-pausing.

---

## Cost

Designed to run on free tiers indefinitely:

| Service        | Free tier                                  | Notes                                  |
| -------------- | ------------------------------------------ | -------------------------------------- |
| Gemini API     | 1,500 requests/day on `gemini-2.0-flash`   | BYOK fallback for power users          |
| Gemini Embed   | Generous free tier on embedding API        | One call per chunk on ingest           |
| Supabase       | 500MB DB                                   | Auto-pauses after 7d inactivity        |
| Upstash Redis  | 10k commands/day                           | Falls back to in-memory if unavailable |
| Render         | Free hobby tier                            | Sleeps on inactivity                   |
| Vercel         | Free hobby tier                            | Generous limits                        |

---

## License

MIT

---

Built by [Shankar V](https://shankarv-portfolio.vercel.app).

# Personal Knowledge Base — Chat with Your Notes

A personal knowledge base where you import your Obsidian vaults, Notion exports, PDF documents, and plain markdown files — then chat with them in natural language.

The LLM **never** answers from its training data. Every response is grounded exclusively in your own notes.

## Key Features

- **Hybrid Search** — Vector similarity + BM25 full-text merged with Reciprocal Rank Fusion
- **Heading-Aware Chunking** — Splits at markdown heading boundaries, not character counts
- **Conversation Memory** — Rolling summary so the assistant remembers last week's chat
- **Query Expansion** — 3 query variants improve recall on ambiguous questions
- **Daily Digest** — Surfaces forgotten notes relevant to what you're working on today
- **Multi-Format Ingestion** — Obsidian (.zip vault), Notion (.zip export), PDF, plain .md

## Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM (chat) | Gemini 1.5 Pro |
| LLM (utils) | Gemini 1.5 Flash |
| Embeddings | Gemini text-embedding-004 |
| Vector DB | Supabase pgvector |
| Full-text | PostgreSQL tsvector + pg_trgm |
| Cache | Upstash Redis |
| Backend | FastAPI + Python 3.11 |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Supabase project (free tier)
- A Google AI Studio API key (free tier)
- Upstash Redis (free tier, optional)

### 1. Database Setup

Run the SQL schema in your Supabase SQL Editor. See the `DATABASE SCHEMA` section in the project documentation.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in your environment variables in .env

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# Fill in your environment variables in .env.local

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
backend/
  app/
    ingestion/    # Chunking, parsing, embedding pipeline
    retrieval/    # Hybrid search (vector + BM25 + RRF)
    chat/         # Streaming chat with grounded responses
    digest/       # Daily digest generation
    api/          # FastAPI routes
    db/           # SQLAlchemy models and CRUD
    cache/        # Redis + in-memory fallback

frontend/
  app/            # Next.js 14 app router pages
  components/     # React components (chat, upload, library, digest)
  lib/            # API client, SSE streaming, auth
  types/          # TypeScript type definitions
  hooks/          # Custom React hooks
```

## Deployment

- **Backend**: Deploy to Fly.io using `fly deploy` from the `backend/` directory
- **Frontend**: Deploy to Vercel by connecting your GitHub repository

## Architecture Highlights

1. **Ingestion Pipeline**: Files are parsed -> chunked at heading boundaries -> embedded in batches -> stored with deduplication via content hashing
2. **Hybrid Retrieval**: Queries are expanded into 3 variants, each searched via pgvector ANN. Results are merged with BM25 full-text search using Reciprocal Rank Fusion
3. **Streaming Chat**: Responses stream token-by-token via SSE. Sources are sent first so the UI can display citation badges immediately
4. **Conversation Memory**: Every 10 messages, a rolling summary is generated to maintain long-term context without exceeding token limits

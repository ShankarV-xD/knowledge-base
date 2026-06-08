# Personal Projects

Shankar has shipped five full-stack projects on his own time. Each one
was built to solve a problem he ran into personally, not as a CV-padding
exercise.

## Agentic Web Researcher

A live, deployed autonomous research agent. The user asks a question;
the agent searches the web with Serper, reads pages with Jina Reader,
compresses intermediate context to stay within token budgets, and
streams a cited answer back to the browser via Server-Sent Events.

**What's interesting about it:** the ReAct loop is hand-rolled. No
LangChain, no LlamaIndex. Each iteration's planning, tool calls,
observations, and final synthesis are explicit code paths he can step
through in a debugger. The reason he avoided LangChain: when something
breaks inside a black-box agent framework, the stack trace tells you
nothing useful. Writing the loop from scratch took more time upfront
but made every failure mode obvious.

It runs on Gemini, persists sessions to Supabase Postgres, caches
search/page results in Upstash Redis (with an in-memory fallback when
Redis is down), and serialises concurrent users through a semaphore.

**Stack:** FastAPI, Next.js, Gemini, Supabase, Serper, Jina Reader, SSE.
**Live:** sv-agentic-web-researcher.vercel.app

## Knowledge Base

The application you're using right now. A personal RAG system that lets
you chat with your own documents — Obsidian vaults, Notion exports,
PDFs, markdown files. It uses hybrid retrieval: vector search via
pgvector combined with BM25 keyword search, fused with Reciprocal Rank
Fusion. Heading-aware chunking preserves document structure. The LLM
expands the user's query into multiple semantic variants before search,
which materially improves recall on short questions.

**What's interesting:** the system answers strictly from the user's
documents — no general knowledge bleed-through — and every answer
includes inline citations to the source chunk. Conversation memory is
rolling, so follow-ups stay coherent without blowing up the context
window.

**Stack:** FastAPI, Next.js, Gemini, pgvector, Redis, Supabase.

## DevHub

A developer toolbelt that figures out what you've pasted and gives you
the right tool. Paste a JWT, it decodes and verifies it. Paste JSON, it
opens an interactive tree. Paste a cron expression, it explains the
schedule. Paste a hex colour, it shows you the colour. Monaco editor,
44 tests, no backend — just runs entirely in the browser.

**Stack:** Next.js, TypeScript, Monaco Editor, Tailwind, Zustand.

## DriveFlix

Streams video files directly from a Google Drive Shared Drive into a
browser with instant seeking, multiple audio tracks, and subtitle
support — without copying, transcoding, or storing the files anywhere.
Range-request proxying through FastAPI plus Shaka Player on the
frontend. Authenticated via Google OAuth.

**Stack:** React, FastAPI, Shaka Player, FFmpeg, Google OAuth.

## NexusDL

An Android app that downloads from YouTube and 1000+ other sites using
yt-dlp under the hood. Picks the best available format, merges audio
and video streams automatically via Android's built-in MediaMuxer,
shows live download speed and ETA, and saves straight to the gallery.
Survives screen rotation.

**Stack:** Kotlin, Jetpack Compose, yt-dlp, Chaquopy, Material 3.

## Which is most impressive?

If a recruiter only has time to look at one, it should be Agentic Web
Researcher. It's deployed, anyone can try it instantly, and the
"no LangChain" angle demonstrates depth in agent architecture rather
than just integration skills.

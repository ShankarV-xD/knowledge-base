# Zero-Cost Deployment Guide

This guide deploys the full stack — FastAPI backend, Next.js frontend, Postgres + pgvector, and Redis — for **$0/month** using free tiers.

---

## Services Used

| Layer | Service | Free Tier Limit |
|---|---|---|
| Database (Postgres + pgvector) | [Supabase](https://supabase.com) | 500 MB DB, 2 GB bandwidth |
| Backend (FastAPI) | [Render](https://render.com) | 750 hrs/month, spins down after 15 min idle |
| Frontend (Next.js) | [Vercel](https://vercel.com) | Unlimited personal projects |
| Redis | [Upstash](https://upstash.com) | 10,000 req/day, 256 MB |
| LLM + Embeddings | [Google Gemini API](https://aistudio.google.com) | 1,500 req/day (free tier) |
| File Storage | Supabase Storage | 1 GB |

---

## Step 1 — Supabase (Database)

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a region close to you, set a strong DB password, save it
3. Once created, go to **Database → Extensions** and enable `vector`
4. Go to **Settings → Database** and copy:
   - **Transaction pooler** connection string (port **6543**, mode `transaction`) — use this as `DATABASE_URL`
   - It looks like: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
5. Append `?sslmode=require` to the URL

Run your schema migrations by connecting with the **direct connection** string (port 5432, not pooler) and running:

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Run all your Alembic migrations, or paste your schema SQL directly
```

If you use Alembic locally:
```bash
cd backend
DATABASE_URL="postgresql+asyncpg://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require" \
  alembic upgrade head
```

---

## Step 2 — Upstash Redis

1. Go to [upstash.com](https://upstash.com) → **Create Database**
2. Choose **Regional**, pick a region, enable **TLS**
3. Copy the **REST URL** and **REST Token** — these become:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

---

## Step 3 — Google Gemini API Key

1. Go to [aistudio.google.com](https://aistudio.google.com) → **Get API key**
2. Create a key — this becomes `GEMINI_API_KEY`
3. Free tier: 1,500 requests/day for Flash, 1,500/day for embeddings

---

## Step 4 — Deploy Backend on Render

### 4a. Prepare the backend

Create `backend/render.yaml` (or use the web UI):

```yaml
services:
  - type: web
    name: pkb-backend
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: GEMINI_API_KEY
        sync: false
      - key: UPSTASH_REDIS_REST_URL
        sync: false
      - key: UPSTASH_REDIS_REST_TOKEN
        sync: false
      - key: AUTH_SECRET
        generateValue: true
      - key: ALLOWED_ORIGINS
        sync: false
```

### 4b. Deploy

1. Push your code to a GitHub repo (backend folder included)
2. Go to [render.com](https://render.com) → **New → Web Service**
3. Connect your GitHub repo
4. Set **Root Directory** to `backend`
5. Set **Build Command**: `pip install -r requirements.txt`
6. Set **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
7. Add environment variables (from the keys above):

```
DATABASE_URL=postgresql+asyncpg://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require
GEMINI_API_KEY=your_key
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
AUTH_SECRET=any_long_random_string_32_chars_min
ALLOWED_ORIGINS=https://your-app.vercel.app
```

8. Click **Deploy** — Render will build and start the service
9. Copy the URL Render gives you: `https://pkb-backend.onrender.com`

> **Note on cold starts**: Render free tier spins down after 15 min of inactivity. First request after sleep takes ~30s. This is unavoidable on the free tier. Consider adding a `/health` endpoint and pinging it every 14 min via a free cron service (e.g., [cron-job.org](https://cron-job.org)) to keep it warm.

### Keep-alive cron (optional but recommended)

```
URL: https://pkb-backend.onrender.com/health
Schedule: every 14 minutes
```

Make sure your backend has a health route:
```python
# In app/main.py or app/api/health.py
@app.get("/health")
async def health():
    return {"status": "ok"}
```

---

## Step 5 — Deploy Frontend on Vercel

### 5a. Deploy

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repo
3. Set **Root Directory** to `frontend`
4. Vercel auto-detects Next.js — no extra config needed
5. Under **Environment Variables**, add:

```
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your_nextauth_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXT_PUBLIC_BACKEND_URL=https://your-render-service.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_ENABLE_TEST_LOGIN=false
```

6. Click **Deploy**
7. Vercel gives you a URL like `https://your-app.vercel.app`

### 5c. Update backend CORS

Go back to Render → your backend service → **Environment** and update:
```
ALLOWED_ORIGINS=https://your-app.vercel.app
```

Then trigger a redeploy on Render (click **Manual Deploy**).

---

## Step 6 — Verify Everything Works

1. Open `https://your-app.vercel.app`
2. Sign up for an account
3. Upload a PDF
4. Wait for ingestion to complete (watch the status badge)
5. Ask a question in chat
6. Confirm sources appear in the response

---

## Environment Variables Reference

### Backend (Render)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase Transaction Pooler URL (asyncpg dialect, port 6543) |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (not anon key) |
| `SUPABASE_STORAGE_BUCKET` | Supabase storage bucket name |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token |
| `AUTH_SECRET` | Random string ≥32 chars for signing JWTs |
| `ALLOWED_ORIGINS` | Vercel URL (for CORS), comma-separated if multiple |
| `ENABLE_TEST_LOGIN` | `false` in production, `true` to enable test account locally |

### Frontend (Vercel)

| Variable | Description |
|---|---|
| `NEXTAUTH_URL` | Your Vercel deployment URL |
| `NEXTAUTH_SECRET` | Random string for NextAuth session signing |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXT_PUBLIC_BACKEND_URL` | Your Render backend URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_ENABLE_TEST_LOGIN` | `false` in production |

---

## Free Tier Limits to Watch

| Service | Limit | When you'll hit it |
|---|---|---|
| Render | 750 hrs/month compute | ~1 instance running 24/7 = 720 hrs, you're fine |
| Render | Spins down after 15 min idle | Normal for personal use; use keep-alive cron |
| Supabase | 500 MB database | ~500k medium-size chunks |
| Supabase | 2 GB bandwidth/month | Scales with usage |
| Gemini | 1,500 req/day (Flash) | Each chat turn = 1 req; each doc page = 1 req |
| Gemini | 1,500 req/day (Embeddings) | Each chunk = 1 req; large PDFs may batch-embed |
| Upstash | 10,000 commands/day | Each rate-limit check = ~2 commands |
| Vercel | Unlimited deploys | No practical limit for personal projects |

---

## Custom Domain (Optional, Still Free)

If you have a domain from Namecheap, Google Domains, or similar:

**Vercel frontend:**
1. Vercel dashboard → your project → **Settings → Domains**
2. Add your domain, follow the DNS instructions

**Render backend** (if you want `api.yourdomain.com`):
1. Render dashboard → your service → **Settings → Custom Domain**
2. Add `api.yourdomain.com`, follow the CNAME instructions

---

## Updating After Code Changes

**Frontend**: Push to GitHub → Vercel auto-deploys (usually < 2 min)

**Backend**: Push to GitHub → Render auto-deploys (usually 3-5 min) OR click **Manual Deploy** in Render dashboard

---

## Troubleshooting

**Backend won't start on Render**
- Check build logs for missing packages
- Make sure `requirements.txt` is in the `backend/` folder
- Verify `DATABASE_URL` uses `postgresql+asyncpg://` (not `postgresql://`)

**CORS errors in browser**
- `FRONTEND_URL` in Render must exactly match your Vercel URL (no trailing slash)
- Redeploy backend after changing env vars

**Ingestion fails immediately**
- Check Render logs for the specific error
- Most common: wrong `DATABASE_URL` dialect or missing `?sslmode=require`

**Embeddings fail**
- Gemini free tier enforces rate limits — if ingesting large PDFs, you may hit 1,500/day
- Check Google AI Studio quota dashboard

**pgvector extension missing**
- Go to Supabase → Database → Extensions → search "vector" → enable it

**First request very slow**
- Render free tier cold start — expected. Set up the keep-alive cron at cron-job.org.

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # The per-user X-Gemini-Key header drives every Gemini call. Outside
    # production this server key is used as a local-dev fallback; in production
    # leave it empty so the app stays pure BYOK.
    gemini_api_key: str = ""
    supabase_url: str = ""
    supabase_service_key: str = ""
    database_url: str
    supabase_storage_bucket: str = "knowledge-base-files"
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""
    allowed_origins: str = "http://localhost:3000"
    max_upload_size_mb: int = 50
    upload_dir: str = "./uploads"
    # JWT secret — set AUTH_SECRET in .env, must be long random string in production
    auth_secret: str = "changeme-set-AUTH_SECRET-in-dotenv!"
    # Public demo account — when true, POST /api/auth/demo issues a token for a
    # shared demo user so visitors can try the app without signing up
    enable_demo_login: bool = True
    demo_email: str = "demo@knowledge-base.app"
    # "production" enforces BYOK (no server-key fallback). Any other value
    # (the default) lets the server fall back to GEMINI_API_KEY for local dev.
    environment: str = "development"

    class Config:
        env_file = ".env"
        # Ignore unknown env vars (e.g. a stale ENABLE_TEST_LOGIN in .env) instead
        # of crashing on startup.
        extra = "ignore"


settings = Settings()


def resolve_gemini_key(header_key):
    """The per-request user key (X-Gemini-Key) always wins. Outside production,
    fall back to the server GEMINI_API_KEY (set it in .env for local dev). In
    production there is no fallback, so each request must bring its own key."""
    if header_key:
        return header_key
    if settings.environment != "production":
        return settings.gemini_api_key
    return ""

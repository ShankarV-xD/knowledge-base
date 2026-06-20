from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Optional: the app runs fully BYOK — every Gemini call uses the per-user
    # key from the X-Gemini-Key header, never this field.
    gemini_api_key: str = ""
    supabase_url: str
    supabase_service_key: str
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

    class Config:
        env_file = ".env"
        # Ignore unknown env vars (e.g. a stale ENABLE_TEST_LOGIN in .env) instead
        # of crashing on startup.
        extra = "ignore"


settings = Settings()

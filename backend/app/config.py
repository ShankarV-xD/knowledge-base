from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str
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
    # Set to true only in local/dev environments to enable the hardcoded test account
    enable_test_login: bool = False

    class Config:
        env_file = ".env"


settings = Settings()

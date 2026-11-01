"""DharaDrishti API — configuration via environment variables."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings, loaded from environment variables."""

    # ── Database ──
    database_url: str = "postgresql+asyncpg://dharadrishti:changeme@postgres:5432/dharadrishti"
    database_url_sync: str = "postgresql://dharadrishti:changeme@postgres:5432/dharadrishti"

    # ── Redis ──
    redis_url: str = "redis://redis:6379/0"

    # ── MinIO ──
    minio_endpoint: str = "minio:9000"
    minio_bucket: str = "dharadrishti"
    aws_access_key_id: str = "minioadmin"
    aws_secret_access_key: str = "minioadmin"

    # ── TiTiler ──
    titiler_endpoint: str = "http://titiler:8001"

    # ── API ──
    admin_token: str = "dev-admin-token-change-in-prod"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    debug: bool = True

    # ── Data ──
    data_dir: str = "/data"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def minio_url(self) -> str:
        return f"http://{self.minio_endpoint}"

    @property
    def s3_endpoint_url(self) -> str:
        return self.minio_url

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()

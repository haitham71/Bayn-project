"""
Application settings.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    APP_NAME: str = "Bayn"
    DEBUG: bool = False

    DATABASE_URL: str | None = None

    JWT_SECRET_KEY: str | None = None
    JWT_ALGORITHM: str | None = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int | None = None
    REFRESH_TOKEN_EXPIRE_DAYS: int | None = None


    AUTHENTICA_BASE_URL: str | None = None
    AUTHENTICA_API_KEY: str | None = None

    R2_ACCOUNT_ID: str | None = None
    R2_ACCESS_KEY_ID: str | None = None
    R2_SECRET_ACCESS_KEY: str | None = None
    R2_BUCKET_NAME: str | None = None
    R2_PUBLIC_URL: str | None = None

    CALCOM_API_KEY: str | None = None
    CALCOM_CLIENT_ID: str | None = None
    CALCOM_CLIENT_SECRET: str | None = None

    DAILY_API_KEY: str | None = None
    DAILY_API_URL: str | None = None
    DAILY_DOMAIN: str | None = None

    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAIL_FROM: str | None = None
    EMAIL_FROM_NAME: str | None = None


    NDA_SERVICE_URL: str | None = None
    NDA_SERVICE_KEY: str | None = None

    FRONTEND_URL: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

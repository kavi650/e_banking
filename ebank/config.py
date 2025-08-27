import os


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-me")
    # Prefer MySQL if DATABASE_URL is provided; fallback to SQLite for local dev
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        f"sqlite:////workspace/ebank/ebank.db",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False


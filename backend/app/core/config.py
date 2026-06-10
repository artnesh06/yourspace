import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./yourspace.db")
    # Groq (legacy)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    # Claude / Anthropic
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    # Which provider to use: "claude" or "groq"
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "claude")
    APP_BIND: str = os.getenv("APP_BIND", "127.0.0.1")
    APP_PORT: int = int(os.getenv("APP_PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    FRONTEND_ORIGINS: str = os.getenv("FRONTEND_ORIGINS", "")

settings = Settings()

import re
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# normalize: driver async (aiosqlite/asyncpg) → sync, biar satu engine buat semua
_url = settings.DATABASE_URL
_url = re.sub(r"\+aiosqlite", "", _url)
_url = re.sub(r"\+asyncpg", "", _url)
# Supabase/Heroku kasih postgres:// — SQLAlchemy butuh postgresql://
_url = re.sub(r"^postgres://", "postgresql://", _url)

engine = create_engine(_url, echo=False, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db_session():
    return SessionLocal()


# SQL portable: jalan di SQLite & PostgreSQL
TABLES = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        pw_salt TEXT NOT NULL,
        pw_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS user_state (
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, key)
    )
    """,
    # dipakai nanti di Fase 3 (share board) — disiapin dari sekarang
    """
    CREATE TABLE IF NOT EXISTS board_shares (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        board_id TEXT NOT NULL,
        invited_email TEXT,
        token TEXT UNIQUE,
        role TEXT NOT NULL DEFAULT 'viewer',
        created_at TEXT NOT NULL
    )
    """,
    # legacy (board blob lama) — dibiarin biar nggak ada yang pecah
    """
    CREATE TABLE IF NOT EXISTS board (
        id INTEGER PRIMARY KEY,
        board_data TEXT NOT NULL
    )
    """,
]


async def init_db():
    with engine.begin() as conn:
        for ddl in TABLES:
            conn.execute(text(ddl))

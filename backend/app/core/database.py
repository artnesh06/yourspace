import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Database setup for PostgreSQL (Supabase) or SQLite
engine = create_engine(settings.DATABASE_URL, echo=settings.DEBUG)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db_session():
    """Get database session"""
    return SessionLocal()

async def init_db():
    """Create all tables on startup"""
    from sqlalchemy import inspect
    
    inspector = inspect(engine)
    
    # Board table
    if "board" not in inspector.get_table_names():
        with engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS board (
                    id SERIAL PRIMARY KEY,
                    board_data TEXT NOT NULL
                )
            """))
    
    # Chat messages table
    if "chat_message" not in inspector.get_table_names():
        with engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS chat_message (
                    id SERIAL PRIMARY KEY,
                    message TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))


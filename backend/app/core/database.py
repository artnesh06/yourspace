import sqlite3
import os

# Always use absolute path relative to this file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "yourspace.db")

def get_db_session():
    """Get SQLite connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

async def init_db():
    """Create all tables on startup"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Board table (single entry, id=1)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS board (
            id INTEGER PRIMARY KEY,
            board_data TEXT NOT NULL
        )
    """)
    
    conn.commit()
    conn.close()


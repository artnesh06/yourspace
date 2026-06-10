from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
import json
from app.core.database import get_db_session

router = APIRouter(prefix="/api/board", tags=["board"])

class CardData(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    due: Optional[str] = None
    posted: bool = False
    comments: List[dict] = []

class ColumnData(BaseModel):
    id: str
    title: str
    cards: List[CardData] = []

class BoardData(BaseModel):
    columns: List[ColumnData] = []

@router.get("/")
async def get_board():
    """Get current board state"""
    session = get_db_session()
    cursor = session.cursor()
    
    cursor.execute("SELECT board_data FROM board WHERE id = 1")
    result = cursor.fetchone()
    session.close()
    
    if result and result[0]:
        board = json.loads(result[0])
    else:
        board = {"columns": []}
    
    return board

@router.post("/")
async def save_board(board: BoardData):
    """Save board state"""
    session = get_db_session()
    cursor = session.cursor()
    
    board_json = board.model_dump_json()
    
    cursor.execute("""
        INSERT OR REPLACE INTO board (id, board_data)
        VALUES (1, ?)
    """, (board_json,))
    
    session.commit()
    session.close()
    
    return {"status": "saved"}



from sqlalchemy import Column, String, Integer, Text, DateTime, JSON, Boolean
from sqlalchemy.sql import func
from app.core.database import Base

class Board(Base):
    __tablename__ = "boards"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, index=True)
    columns = Column(JSON, nullable=False)  # Kanban columns structure
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
class Card(Base):
    __tablename__ = "cards"
    
    id = Column(String, primary_key=True)
    board_id = Column(String, index=True)
    column_id = Column(String, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(String, nullable=True)
    posted = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, index=True)
    role = Column(String)  # "user" or "assistant"
    content = Column(Text)
    tool_calls = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

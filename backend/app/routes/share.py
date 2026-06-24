"""Shareable board links — anyone with the token can view & edit."""
import json
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text

from app.core.database import get_db_session
from app.core.security import get_current_user

router = APIRouter(prefix="/api/share", tags=["share"])


def _now():
    return datetime.now(timezone.utc).isoformat()


# ── GET token info for owner ──────────────────────────────────────────────────

@router.get("/board/{board_id}")
async def get_share(board_id: str, user: dict = Depends(get_current_user)):
    session = get_db_session()
    try:
        row = session.execute(
            text("SELECT token FROM board_shares WHERE owner_id = :u AND board_id = :b"),
            {"u": user["id"], "b": board_id},
        ).fetchone()
    finally:
        session.close()
    if not row:
        return {"token": None, "enabled": False}
    return {"token": row[0], "enabled": bool(row[0])}


# ── Enable sharing (generate token) ──────────────────────────────────────────

@router.post("/board/{board_id}")
async def enable_share(board_id: str, user: dict = Depends(get_current_user)):
    token = secrets.token_urlsafe(20)
    now = _now()
    session = get_db_session()
    try:
        existing = session.execute(
            text("SELECT id FROM board_shares WHERE owner_id = :u AND board_id = :b"),
            {"u": user["id"], "b": board_id},
        ).fetchone()
        if existing:
            session.execute(
                text("UPDATE board_shares SET token = :t WHERE owner_id = :u AND board_id = :b"),
                {"t": token, "u": user["id"], "b": board_id},
            )
        else:
            share_id = secrets.token_hex(8)
            session.execute(
                text("""INSERT INTO board_shares (id, owner_id, board_id, token, role, created_at)
                        VALUES (:id, :u, :b, :t, 'editor', :ts)"""),
                {"id": share_id, "u": user["id"], "b": board_id, "t": token, "ts": now},
            )
        session.commit()
    finally:
        session.close()
    return {"token": token, "enabled": True}


# ── Disable sharing (revoke token) ───────────────────────────────────────────

@router.delete("/board/{board_id}")
async def disable_share(board_id: str, user: dict = Depends(get_current_user)):
    session = get_db_session()
    try:
        session.execute(
            text("UPDATE board_shares SET token = NULL WHERE owner_id = :u AND board_id = :b"),
            {"u": user["id"], "b": board_id},
        )
        session.commit()
    finally:
        session.close()
    return {"token": None, "enabled": False}


# ── Public: read board by token (no auth) ────────────────────────────────────

@router.get("/view/{token}")
async def view_shared(token: str):
    session = get_db_session()
    try:
        row = session.execute(
            text("SELECT owner_id, board_id FROM board_shares WHERE token = :t"),
            {"t": token},
        ).fetchone()
        if not row:
            raise HTTPException(404, "Link tidak valid atau sudah dinonaktifkan")
        owner_id, board_id = row
        state_row = session.execute(
            text("SELECT data FROM user_state WHERE user_id = :u AND key = 'boards'"),
            {"u": owner_id},
        ).fetchone()
    finally:
        session.close()

    raw = json.loads(state_row[0]) if state_row else {}
    boards = raw.get("boards", raw) if isinstance(raw, dict) else raw
    board = next((b for b in boards if b.get("id") == board_id), None)
    if not board:
        raise HTTPException(404, "Board tidak ditemukan")
    return {"board": board, "board_id": board_id, "owner_id": owner_id}


# ── Public: save board by token (editable shared link) ───────────────────────

class SaveBody(BaseModel):
    board: dict


@router.put("/view/{token}")
async def save_shared(token: str, body: SaveBody):
    session = get_db_session()
    try:
        row = session.execute(
            text("SELECT owner_id, board_id FROM board_shares WHERE token = :t"),
            {"t": token},
        ).fetchone()
        if not row:
            raise HTTPException(404, "Link tidak valid atau sudah dinonaktifkan")
        owner_id, board_id = row

        state_row = session.execute(
            text("SELECT data FROM user_state WHERE user_id = :u AND key = 'boards'"),
            {"u": owner_id},
        ).fetchone()
        raw = json.loads(state_row[0]) if state_row else {}
        is_wrapped = isinstance(raw, dict) and "boards" in raw
        boards = raw["boards"] if is_wrapped else (raw if isinstance(raw, list) else [])
        updated_boards = [body.board if b.get("id") == board_id else b for b in boards]
        updated = {**raw, "boards": updated_boards} if is_wrapped else updated_boards

        now = _now()
        result = session.execute(
            text("""UPDATE user_state SET data = :d, updated_at = :ts
                    WHERE user_id = :u AND key = 'boards'"""),
            {"d": json.dumps(updated, ensure_ascii=False), "ts": now, "u": owner_id},
        )
        if result.rowcount == 0:
            session.execute(
                text("""INSERT INTO user_state (user_id, key, data, updated_at)
                        VALUES (:u, 'boards', :d, :ts)"""),
                {"u": owner_id, "d": json.dumps(updated, ensure_ascii=False), "ts": now},
            )
        session.commit()
    finally:
        session.close()
    return {"ok": True}

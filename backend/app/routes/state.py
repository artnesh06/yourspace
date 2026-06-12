"""Per-user state KV: boards, attendance, team, activity, chat.
Frontend sync ke sini menggantikan localStorage — source of truth di server."""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text

from app.core.database import get_db_session
from app.core.security import get_current_user

router = APIRouter(prefix="/api/state", tags=["state"])

ALLOWED_KEYS = {"boards", "attendance", "team", "activity", "chat"}
MAX_BYTES = 4 * 1024 * 1024  # 4MB per key (gambar harus lewat /api/upload, bukan ditaruh sini)


class StateBody(BaseModel):
    data: dict | list


def _check_key(key: str):
    if key not in ALLOWED_KEYS:
        raise HTTPException(404, f"Key '{key}' tidak dikenal")


@router.get("/{key}")
async def get_state(key: str, user: dict = Depends(get_current_user)):
    _check_key(key)
    session = get_db_session()
    try:
        row = session.execute(
            text("SELECT data FROM user_state WHERE user_id = :u AND key = :k"),
            {"u": user["id"], "k": key},
        ).fetchone()
    finally:
        session.close()
    if not row:
        return JSONResponse({"data": None})
    return JSONResponse({"data": json.loads(row[0])})


@router.put("/{key}")
async def put_state(key: str, body: StateBody, user: dict = Depends(get_current_user)):
    _check_key(key)
    raw = json.dumps(body.data, ensure_ascii=False)
    if len(raw.encode()) > MAX_BYTES:
        raise HTTPException(413, "Data terlalu besar — upload gambar lewat /api/upload")

    now = datetime.now(timezone.utc).isoformat()
    session = get_db_session()
    try:
        updated = session.execute(
            text("""UPDATE user_state SET data = :d, updated_at = :ts
                    WHERE user_id = :u AND key = :k"""),
            {"d": raw, "ts": now, "u": user["id"], "k": key},
        )
        if updated.rowcount == 0:
            session.execute(
                text("""INSERT INTO user_state (user_id, key, data, updated_at)
                        VALUES (:u, :k, :d, :ts)"""),
                {"u": user["id"], "k": key, "d": raw, "ts": now},
            )
        session.commit()
    finally:
        session.close()
    return {"ok": True, "updated_at": now}

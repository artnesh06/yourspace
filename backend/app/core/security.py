"""Auth tanpa dependency tambahan: PBKDF2 (stdlib) + token HMAC-signed."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path

from fastapi import Header, HTTPException
from sqlalchemy import text

from app.core.database import get_db_session

TOKEN_TTL = 60 * 60 * 24 * 30  # 30 hari

# secret persisten: env SECRET_KEY > file lokal (auto-generate sekali)
_SECRET_FILE = Path(__file__).resolve().parents[2] / "data" / ".secret"


def _load_secret() -> bytes:
    env = os.getenv("SECRET_KEY")
    if env:
        return env.encode()
    try:
        return _SECRET_FILE.read_bytes()
    except FileNotFoundError:
        _SECRET_FILE.parent.mkdir(parents=True, exist_ok=True)
        secret = secrets.token_bytes(32)
        _SECRET_FILE.write_bytes(secret)
        return secret


SECRET = _load_secret()


# ── password ──────────────────────────────────────────────────────
def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 120_000)
    return salt, dk.hex()


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    _, h = hash_password(password, salt)
    return hmac.compare_digest(h, expected_hash)


# ── token ─────────────────────────────────────────────────────────
def _b64e(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def create_token(user_id: str) -> str:
    payload = json.dumps({"uid": user_id, "exp": int(time.time()) + TOKEN_TTL}).encode()
    sig = hmac.new(SECRET, payload, hashlib.sha256).digest()
    return f"{_b64e(payload)}.{_b64e(sig)}"


def decode_token(token: str) -> str | None:
    try:
        payload_b64, sig_b64 = token.split(".")
        payload = _b64d(payload_b64)
        expected = hmac.new(SECRET, payload, hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64d(sig_b64)):
            return None
        data = json.loads(payload)
        if data.get("exp", 0) < time.time():
            return None
        return data.get("uid")
    except Exception:
        return None


# ── FastAPI dependency ────────────────────────────────────────────
def get_current_user(authorization: str = Header(default="")) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Belum login")
    user_id = decode_token(authorization[7:])
    if not user_id:
        raise HTTPException(401, "Token tidak valid / kedaluwarsa")
    session = get_db_session()
    try:
        row = session.execute(
            text("SELECT id, email, name FROM users WHERE id = :id"), {"id": user_id}
        ).fetchone()
    finally:
        session.close()
    if not row:
        raise HTTPException(401, "User tidak ditemukan")
    return {"id": row[0], "email": row[1], "name": row[2]}

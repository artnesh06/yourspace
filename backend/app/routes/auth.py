import os
import re
import secrets
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from app.core.database import get_db_session
from app.core.security import create_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleRequest(BaseModel):
    credential: str  # Google ID token (JWT) from Google Identity Services


def _user_payload(user_id: str, email: str, name: str) -> dict:
    return {"token": create_token(user_id), "user": {"id": user_id, "email": email, "name": name}}


@router.post("/register")
async def register(req: RegisterRequest):
    name = req.name.strip()
    email = req.email.strip().lower()
    if len(name) < 2:
        raise HTTPException(400, "Nama minimal 2 karakter")
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Email tidak valid")
    if len(req.password) < 6:
        raise HTTPException(400, "Password minimal 6 karakter")

    session = get_db_session()
    try:
        exists = session.execute(
            text("SELECT 1 FROM users WHERE email = :e"), {"e": email}
        ).fetchone()
        if exists:
            raise HTTPException(409, "Email sudah terdaftar — coba login")

        user_id = "u_" + secrets.token_hex(8)
        salt, pw_hash = hash_password(req.password)
        session.execute(
            text("""INSERT INTO users (id, email, name, pw_salt, pw_hash, created_at)
                    VALUES (:id, :email, :name, :salt, :hash, :ts)"""),
            {"id": user_id, "email": email, "name": name, "salt": salt,
             "hash": pw_hash, "ts": datetime.now(timezone.utc).isoformat()},
        )
        session.commit()
    finally:
        session.close()

    return _user_payload(user_id, email, name)


@router.post("/login")
async def login(req: LoginRequest):
    email = req.email.strip().lower()
    session = get_db_session()
    try:
        row = session.execute(
            text("SELECT id, name, pw_salt, pw_hash FROM users WHERE email = :e"),
            {"e": email},
        ).fetchone()
    finally:
        session.close()

    if not row or not verify_password(req.password, row[2], row[3]):
        raise HTTPException(401, "Email atau password salah")

    return _user_payload(row[0], email, row[1])


@router.post("/google")
async def google_login(req: GoogleRequest):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(500, "Google login belum dikonfigurasi (GOOGLE_CLIENT_ID kosong)")

    # Verify the ID token with Google
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": req.credential},
            )
    except httpx.HTTPError:
        raise HTTPException(503, "Gagal menghubungi Google")

    if resp.status_code != 200:
        raise HTTPException(401, "Token Google tidak valid")

    info = resp.json()
    # aud must match our client ID, and email must be verified
    if info.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(401, "Token Google bukan untuk aplikasi ini")
    if info.get("email_verified") not in ("true", True):
        raise HTTPException(401, "Email Google belum terverifikasi")

    email = (info.get("email") or "").strip().lower()
    name = (info.get("name") or email.split("@")[0] or "User").strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(401, "Email Google tidak valid")

    session = get_db_session()
    try:
        row = session.execute(
            text("SELECT id, name FROM users WHERE email = :e"), {"e": email}
        ).fetchone()
        if row:
            user_id, user_name = row[0], row[1]
        else:
            # create a passwordless account (random unusable password hash)
            user_id = "u_" + secrets.token_hex(8)
            salt, pw_hash = hash_password(secrets.token_hex(16))
            session.execute(
                text("""INSERT INTO users (id, email, name, pw_salt, pw_hash, created_at)
                        VALUES (:id, :email, :name, :salt, :hash, :ts)"""),
                {"id": user_id, "email": email, "name": name, "salt": salt,
                 "hash": pw_hash, "ts": datetime.now(timezone.utc).isoformat()},
            )
            session.commit()
            user_name = name
    finally:
        session.close()

    return _user_payload(user_id, email, user_name)


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user}

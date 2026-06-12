import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.core.security import get_current_user

router = APIRouter(prefix="/api/upload", tags=["upload"])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "data" / "uploads"
MAX_SIZE = 15 * 1024 * 1024  # 15MB

SAFE_EXT = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif",
    ".pdf", ".txt", ".md", ".csv", ".zip", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
}


@router.post("")
async def upload_file(file: UploadFile, user: dict = Depends(get_current_user)):
    ext = Path(file.filename or "file").suffix.lower()
    if ext not in SAFE_EXT:
        raise HTTPException(400, f"Tipe file {ext or '(tanpa ekstensi)'} tidak diizinkan")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(413, "File maksimal 15MB")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{user['id']}_{secrets.token_hex(8)}{ext}"
    (UPLOAD_DIR / name).write_bytes(content)

    return {
        "url": f"/uploads/{name}",
        "name": file.filename,
        "size": len(content),
        "type": file.content_type,
    }

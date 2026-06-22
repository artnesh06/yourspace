import os
import secrets
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.core.security import get_current_user

router = APIRouter(prefix="/api/upload", tags=["upload"])

MAX_SIZE = 15 * 1024 * 1024  # 15MB

# R2 credentials
R2_ACCESS_KEY = os.getenv('R2_ACCESS_KEY')
R2_SECRET_KEY = os.getenv('R2_SECRET_KEY')
R2_ENDPOINT = os.getenv('R2_ENDPOINT')
R2_BUCKET = os.getenv('R2_BUCKET', 'yourspace')

# Initialize S3 client for R2
s3_client = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
    region_name='auto'
) if all([R2_ACCESS_KEY, R2_SECRET_KEY, R2_ENDPOINT]) else None

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

    name = f"{user['id']}_{secrets.token_hex(8)}{ext}"

    if s3_client:
        try:
            s3_client.put_object(
                Bucket=R2_BUCKET,
                Key=name,
                Body=content,
                ContentType=file.content_type or "application/octet-stream"
            )
            url = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': R2_BUCKET, 'Key': name},
                ExpiresIn=86400  # 24 hours
            )
        except ClientError as e:
            raise HTTPException(500, f"Upload gagal: {str(e)}")
    else:
        raise HTTPException(500, "R2 belum dikonfigurasi")

    return {
        "url": url,
        "name": file.filename,
        "size": len(content),
        "type": file.content_type,
    }

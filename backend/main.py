from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import init_db
from app.routes import chat, board, auth, state, upload, share

DEFAULT_CORS_ORIGINS = [
    "https://yourspace.artnesh.cloud",
    "https://www.yourspace.artnesh.cloud",
    "https://artnesh.cloud",
    "https://yourspace-tawny.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
]

def get_cors_origins():
    configured = [
        origin.strip()
        for origin in settings.FRONTEND_ORIGINS.split(",")
        if origin.strip()
    ]
    return DEFAULT_CORS_ORIGINS + configured

CORS_ORIGIN_REGEX = r"^https://([a-z0-9-]+\.)?artnesh\.cloud$"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create DB tables
    await init_db()
    yield
    # Shutdown: nothing needed for SQLite

app = FastAPI(title="Your Space API", version="1.0.0", lifespan=lifespan)

# CORS middleware — allow local dev + production artnesh.cloud origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(chat.router)
app.include_router(board.router)
app.include_router(auth.router)
app.include_router(state.router)
app.include_router(upload.router)
app.include_router(share.router)

# Uploaded files (gambar attachment dll)
_uploads_dir = Path(__file__).resolve().parent / "data" / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")

@app.get("/")
async def root():
    return {"message": "Your Space API is running ✓"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.APP_BIND,
        port=settings.APP_PORT,
        reload=settings.DEBUG
    )

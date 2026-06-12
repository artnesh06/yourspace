# Your Space — Backend API

FastAPI backend untuk Your Space (Kanban board + AI Chat agent).

## Cara paling gampang

Jalankan dari root project:

```bash
cd "/Users/user/Documents/VIBE CODE/YOUR SPACE"
./start-local.sh
```

Helper ini menyalakan backend di `http://127.0.0.1:8000` dan frontend Vite di port yang tersedia.

## Backend saja

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
DEBUG=False APP_BIND=127.0.0.1 APP_PORT=8000 venv/bin/python main.py
```

Server akan run di `http://127.0.0.1:8000`

## Check Health

```bash
curl http://127.0.0.1:8000/health
```

## API Endpoints

### Auth
- **POST** `/api/auth/register` — daftar akun lokal
- **POST** `/api/auth/login` — login akun lokal
- **GET** `/api/auth/me` — cek user dari token

### App State
- **GET/PUT** `/api/state` — load/simpan state app per user

### Upload
- **POST** `/api/upload` — upload file/card asset

### Chat
- **POST** `/api/chat/message` — Send message to AI agent

### Health
- **GET** `/health` — Server health check

## Project Structure

```
backend/
├── app/
│   ├── core/
│   │   ├── config.py       # Settings
│   │   ├── database.py     # SQLAlchemy setup
│   │   └── security.py     # Password/JWT helpers
│   ├── models/
│   │   └── board.py        # DB models
│   ├── routes/
│   │   ├── auth.py         # Register/login/me
│   │   ├── chat.py         # AI chat endpoints
│   │   ├── state.py        # User app state
│   │   └── upload.py       # Upload endpoint
│   └── services/
│       └── chat_service.py # AI service
├── data/                   # Runtime local data, ignored by git
├── main.py                 # FastAPI app
├── requirements.txt        # Dependencies
└── start.sh                # Start script
```

## Notes

- Using SQLite by default (can switch to PostgreSQL)
- API key handled server-side
- `backend/data/.secret`, memory, upload, dan database lokal tidak ikut commit

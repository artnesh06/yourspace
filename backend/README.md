# Your Space — Backend API

FastAPI backend untuk Your Space (Kanban board + AI Chat agent).

## Setup

### 1. Copy .env
```bash
cp .env.example .env
```

Edit `.env` dan masukkan Groq API key (dapatkan dari https://console.groq.com/keys):
```
GROQ_API_KEY=your_groq_api_key_here
```

### 2. Install & Run
```bash
./start.sh
```

Server akan run di `http://127.0.0.1:8000`

### 3. Check Health
```bash
curl http://127.0.0.1:8000/health
```

## API Endpoints

### Chat
- **POST** `/api/chat/message` — Send message to AI agent
- **POST** `/api/chat/test` — Test Groq API connection

### Health
- **GET** `/health` — Server health check

## Project Structure

```
backend/
├── app/
│   ├── core/
│   │   ├── config.py       # Settings from .env
│   │   └── database.py     # SQLAlchemy setup
│   ├── models/
│   │   └── board.py        # DB models (Board, Card, ChatMessage)
│   ├── routes/
│   │   └── chat.py         # Chat API endpoints
│   └── services/
│       └── chat_service.py # Groq API + Agent logic
├── main.py                 # FastAPI app
├── requirements.txt        # Dependencies
└── start.sh                # Start script
```

## Next Steps

1. **Frontend integration** — Update chat.html to call `/api/chat/message`
2. **Board endpoints** — Add `/api/board/` routes for card operations
3. **Database** — Persist chat history & board state
4. **Authentication** — Add user auth (JWT)
5. **Deploy** — Docker / Heroku / Railway

## Notes

- Using SQLite by default (can switch to PostgreSQL)
- Groq API calls handled server-side (safer for API keys)
- Agentic loop runs up to 5 iterations max
- All tool execution will be implemented as needed

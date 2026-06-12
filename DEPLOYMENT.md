# Deployment Guide

## Overview

This project uses:
- `backend/` with FastAPI and SQLAlchemy
- Postgres-compatible `DATABASE_URL`
- `frontend/` with Vite and `VITE_API_BASE_URL`
- Self-hosted deployment using Contabo + Coolify

## Current production readiness

### Backend
- `backend/Dockerfile` is already created for production.
- `backend/requirements.txt` includes `psycopg2-binary` for Postgres.
- `backend/app/core/database.py` is ready for SQLAlchemy with Postgres.

### Frontend
- `frontend/src/lib/api.js` reads `import.meta.env.VITE_API_BASE_URL`.
- Set `VITE_API_BASE_URL` in Coolify or frontend deployment env to point to the backend.

## Contabo / Coolify setup

### Firewall requirements
Open these TCP ports in Contabo firewall and attach the firewall to the VPS:
- `8000` (Coolify dashboard / backend service internal port)
- `80` (HTTP)
- `443` (HTTPS)

### Coolify dashboard access
After opening the firewall, use:
- `http://161.97.156.23:8000`

If the dashboard loads, proceed to connect GitHub and deploy services.

## Deploy backend in Coolify

### Service configuration
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port 8000`

### Environment variables
Set these in the Coolify service env:
```env
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE_NAME
AI_PROVIDER=claude
ANTHROPIC_API_KEY=your_claude_api_key
APP_BIND=0.0.0.0
APP_PORT=8000
DEBUG=false
```

## Deploy frontend in Coolify

### Service configuration
- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`

### Environment variables
Set this in the frontend deployment env:
```env
VITE_API_BASE_URL=https://api.artnesh.cloud
```

## DNS and domain
- Point `artnesh.cloud` A record to `161.97.156.23`.
- Configure the domain in Coolify once the dashboard is available.
- Enable SSL through Coolify after the domain is attached.

## Required config checklist
### Supabase / database
- Supabase project URL: `https://supabase.artnesh.cloud`
- Supabase Postgres host + port
- Supabase Postgres database name
- Supabase Postgres username
- Supabase Postgres password
- Supabase JDBC/connection string if needed

### Backend (`api.artnesh.cloud`)
- `DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE_NAME`
- `AI_PROVIDER=claude`
- `ANTHROPIC_API_KEY=your_claude_api_key`
- `APP_BIND=0.0.0.0`
- `APP_PORT=8000`
- `DEBUG=false`

### Frontend (`artnesh.cloud`)
- `VITE_API_BASE_URL=https://api.artnesh.cloud`

### Coolify deployment
- GitHub repo URL: `https://github.com/artnesh06/yourspace`
- Backend root dir: `backend`
- Frontend root dir: `frontend`
- Frontend publish dir: `dist`
- Auto-deploy enabled on GitHub push

### Firewall / network
- TCP 8000 open until Coolify dashboard finished
- TCP 80 open for HTTP
- TCP 443 open for HTTPS

## Notes
- If Coolify cannot be reached externally, the provider firewall is still blocking port `8000`.
- Use backend service logs to verify `DATABASE_URL` and Claude env values.
- For local testing, `frontend/src/lib/api.js` will strip trailing slashes from `VITE_API_BASE_URL`.

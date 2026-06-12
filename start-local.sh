#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

echo "Starting Your Space backend on http://127.0.0.1:8000"
cd "$BACKEND_DIR"
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt -q
DEBUG=False APP_BIND=127.0.0.1 APP_PORT=8000 venv/bin/python main.py &
BACKEND_PID=$!

echo "Waiting for backend..."
for attempt in {1..30}; do
  if curl -fsS "http://127.0.0.1:8000/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if ! kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    echo "Backend stopped unexpectedly."
    exit 1
  fi
  if [ "$attempt" -eq 30 ]; then
    echo "Backend did not respond on http://127.0.0.1:8000/health"
    exit 1
  fi
done

echo "Starting Your Space frontend. If 5173 is busy, Vite will use the next free port."
cd "$FRONTEND_DIR"
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5173

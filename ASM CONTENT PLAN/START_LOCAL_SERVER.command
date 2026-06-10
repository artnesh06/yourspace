#!/bin/zsh
cd "$(dirname "$0")"
echo "Starting ASM Content Plan local server..."
echo "Open this URL after the server starts:"
echo "http://local/3000/app.html"
echo ""
python3 -m http.server 3000 --bind 127.0.0.1

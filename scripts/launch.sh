#!/usr/bin/env bash
# Lance le serveur de dev Dofus Craft (si besoin) et ouvre l'interface dans le navigateur.
set -e

cd "$(dirname "$0")/.."

PORT=5173
URL="http://localhost:$PORT"
LOG_FILE="/tmp/dofus-craft-dev.log"

if ! curl -s -o /dev/null "$URL"; then
  nohup npm run dev -- --port "$PORT" --strictPort > "$LOG_FILE" 2>&1 &
  disown

  for _ in $(seq 1 30); do
    curl -s -o /dev/null "$URL" && break
    sleep 1
  done
fi

cmd.exe /c start "" "$URL" >/dev/null 2>&1 || explorer.exe "$URL" >/dev/null 2>&1 || true

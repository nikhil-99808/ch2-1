#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3.10 or newer is required."
  exit 1
fi
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
if [ ! -f .env ]; then cp .env.example .env; fi
echo "Add your Groq API key to .env, save, and run this script again."
echo "Open http://127.0.0.1:8000"
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

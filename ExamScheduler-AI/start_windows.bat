@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo       ExamScheduler AI - Windows Setup
echo ==========================================
where py >nul 2>nul
if errorlevel 1 (
  echo Python launcher not found. Install Python 3.10 or newer and try again.
  pause
  exit /b 1
)
if not exist .venv py -3 -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
if not exist .env copy .env.example .env >nul
echo.
echo Add your Groq API key in the .env file, save it, then restart this script.
echo Starting server at http://127.0.0.1:8000
start "ExamScheduler AI Server" cmd /k "cd /d %~dp0 && .venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000"
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:8000
echo Server started. You can close this setup window; keep the server window open.
pause

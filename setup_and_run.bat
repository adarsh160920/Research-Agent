@echo off
REM ════════════════════════════════════════════════════════════
REM  Research Agentic AI — Windows Setup & Launch Script
REM  Model: qwen/qwen3.8-27b via Groq API
REM ════════════════════════════════════════════════════════════
title Research Agentic AI Setup

color 0B
echo.
echo  ======================================================
echo   Research Agentic AI — Powered by Qwen ^& Groq
echo   Model: qwen/qwen3.8-27b
echo  ======================================================
echo.

REM ── Step 1: Navigate to script directory ─────────────────────
cd /d "%~dp0"

REM ── Step 2: Check for Python ──────────────────────────────────
echo [1/6] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Python is not installed or not in PATH.
    echo  Please install Python 3.10+ from https://www.python.org/downloads/
    echo  Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)
python --version
echo       Python found. OK.
echo.

REM ── Step 3: Create virtual environment ────────────────────────
echo [2/6] Setting up virtual environment...
if not exist ".venv" (
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo  ERROR: Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo       Virtual environment created. OK.
) else (
    echo       Virtual environment already exists. Skipping.
)
echo.

REM ── Step 4: Activate virtual environment ──────────────────────
echo [3/6] Activating virtual environment...
call .venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo  ERROR: Failed to activate virtual environment.
    pause
    exit /b 1
)
echo       Virtual environment activated. OK.
echo.

REM ── Step 5: Install dependencies ─────────────────────────────
echo [4/6] Installing Python dependencies...
pip install -r requirements.txt --quiet --disable-pip-version-check
if %errorlevel% neq 0 (
    echo  WARNING: Some packages may not have installed correctly.
    echo  Trying again with verbose output...
    pip install -r requirements.txt
)
echo       Dependencies installed. OK.
echo.

REM ── Step 6: Check for .env file ──────────────────────────────
echo [5/6] Checking environment configuration...
if not exist ".env" (
    echo.
    echo  !! IMPORTANT: .env file not found !!
    echo  Creating .env from template...
    copy ".env.example" ".env" >nul
    echo.
    echo  ══════════════════════════════════════════════════════
    echo   ACTION REQUIRED: Configure your Groq API Key
    echo  ══════════════════════════════════════════════════════
    echo.
    echo   1. Open the file: %~dp0.env
    echo   2. Replace "your_groq_api_key_here" with your actual key
    echo   3. Get a free key at: https://console.groq.com
    echo   4. Save the file and run this script again
    echo.
    echo  ══════════════════════════════════════════════════════
    echo.
    notepad .env
    echo.
    echo  After saving your API key, press any key to continue...
    pause >nul
) else (
    echo       .env file found. OK.
)
echo.

REM ── Step 7: Create uploads directory ─────────────────────────
if not exist "uploads" mkdir uploads
echo [6/6] Uploads directory ready. OK.
echo.

REM ── Launch Application ────────────────────────────────────────
echo  ======================================================
echo   Launching Research Agentic AI Application...
echo  ======================================================
echo.
echo   The application will open in your browser shortly.
echo   URL: http://localhost:5000
echo.
echo   Press CTRL+C in this window to stop the server.
echo.

REM ── Open browser after 2 second delay ────────────────────────
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000"

REM ── Start Flask server ────────────────────────────────────────
python app.py

REM ── Graceful shutdown ─────────────────────────────────────────
echo.
echo  Server stopped. Goodbye!
echo.
pause

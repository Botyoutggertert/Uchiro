@echo off
REM Uchiro Store Bot - Auto-restart launcher for Windows
REM Edit the SET lines below with your real tokens, then save.

set ADMIN_BOT_TOKEN=PUT_YOUR_ADMIN_BOT_TOKEN_HERE
set STORE_BOT_TOKEN=PUT_YOUR_STORE_BOT_TOKEN_HERE
set OWNER_IDS=PUT_YOUR_TELEGRAM_ID_HERE

cd /d "%~dp0"

:loop
echo [%date% %time%] Starting Uchiro Store Bot...
python main.py
echo [%date% %time%] Bot stopped/crashed. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop

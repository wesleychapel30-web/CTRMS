@echo off
set PROJECT_DIR=C:\Users\CARL\Desktop\PROJECTS\CTRMS

echo Starting CTRMS...

start "CTRMS Backend" cmd /k "cd /d %PROJECT_DIR% && call venv\Scripts\activate && python manage.py runserver"
start "CTRMS Frontend" cmd /k "cd /d %PROJECT_DIR%\frontend && npm run dev"

timeout /t 3 >nul
start http://127.0.0.1:5173

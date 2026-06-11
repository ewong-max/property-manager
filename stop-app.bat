@echo off
echo Stopping Property Manager...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 " ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5174 " ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
echo Done.
timeout /t 2 /nobreak >nul

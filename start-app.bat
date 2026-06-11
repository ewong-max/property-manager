@echo off
echo Starting Property Manager...

start "Property Manager - Server" cmd /k "cd /d %~dp0server && npx ts-node-dev --respawn --transpile-only src/index.ts"
timeout /t 5 /nobreak >nul
start "Property Manager - Client" cmd /k "cd /d %~dp0client && npm run dev"
timeout /t 6 /nobreak >nul
start http://localhost:5174

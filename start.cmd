@echo off
rem Double-click to run Guitar Prompter locally at http://localhost:5179
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
rem --strictPort: songs are saved per address, so always use the same port
call npx vite --port 5179 --strictPort --open

@echo off
setlocal

set "REPO_ROOT=%~dp0.."
set "WORKER_DIR=%REPO_ROOT%\viza-be\submission-service"

if not exist "%WORKER_DIR%\package.json" (
  echo Could not find submission-service at:
  echo   %WORKER_DIR%
  pause
  exit /b 1
)

echo Starting VIZA Indonesia submission worker...
echo.
echo Keep this window open while you click Submit in the VIZA portal.
echo Close this window or press Ctrl+C when you are done.
echo.

cd /d "%WORKER_DIR%"
set "PORT=18080"
set "ID_LOCAL_CARD_SESSION_ENABLED=true"
npm run dev

echo.
echo Worker stopped.
pause

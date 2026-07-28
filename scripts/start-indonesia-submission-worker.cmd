@echo off
setlocal

set "REPO_ROOT=%~dp0.."
set "WORKER_DIR=%REPO_ROOT%\viza-be\submission-service"

if /I not "%VIZA_ALLOW_LOCAL_INDONESIA_WORKER%"=="1" (
  echo Local Indonesia submission worker was not started.
  echo.
  echo Indonesia B1/C1 production payment jobs are owned by the single Fly worker
  echo because the one-time card exists only in that worker's short-lived memory.
  echo Running this local worker at the same time can claim the production queue
  echo without the card session and prevent Finpay / bank OTP from starting.
  echo.
  echo For an intentional local-only runner test, first set:
  echo   VIZA_ALLOW_LOCAL_INDONESIA_WORKER=1
  exit /b 2
)

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

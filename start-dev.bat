@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "BACKEND_DIR=%ROOT%\backend"
set "FRONTEND_DIR=%ROOT%\frontend"
set "BACKEND_PORT=8000"
set "FRONTEND_PORT=5173"
set "BACKEND_URL=http://127.0.0.1:%BACKEND_PORT%/docs"
set "FRONTEND_URL=http://127.0.0.1:%FRONTEND_PORT%/"
set "VERIFY_FAILED=0"

title NotesApp Dev Launcher

echo.
echo NotesApp dev launcher
echo Root: %ROOT%
echo.

if not exist "%BACKEND_DIR%\app\main.py" (
  echo Backend entrypoint was not found at "%BACKEND_DIR%\app\main.py".
  exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
  echo Frontend package.json was not found at "%FRONTEND_DIR%\package.json".
  exit /b 1
)

if /I "%~1"=="restart" (
  echo Restart requested. Stopping anything currently using the dev ports...
  call :stop_port %BACKEND_PORT% "backend"
  call :stop_port %FRONTEND_PORT% "frontend"
  echo.
)

call :choose_python
if errorlevel 1 exit /b 1

call :ensure_backend_deps
if errorlevel 1 exit /b 1

call :ensure_frontend_deps
if errorlevel 1 exit /b 1

call :start_backend
if errorlevel 1 exit /b 1

call :start_frontend
if errorlevel 1 exit /b 1

echo.
echo Verifying servers...
call :wait_url "Backend" "%BACKEND_URL%" 35 || set "VERIFY_FAILED=1"
call :wait_url "Frontend" "%FRONTEND_URL%" 35 || set "VERIFY_FAILED=1"

echo.
if "%VERIFY_FAILED%"=="0" (
  echo Ready.
  echo Frontend: %FRONTEND_URL%
  echo Backend:  %BACKEND_URL%
  echo.
  echo File change support:
  echo - Frontend runs through Vite, so browser refresh/HMR is automatic.
  echo - Backend runs through uvicorn --reload, so Python changes restart the API.
) else (
  echo One or more services did not respond in time.
  echo Check the "NotesApp Backend" and "NotesApp Frontend" terminal windows for details.
  exit /b 1
)

exit /b 0

:choose_python
if defined NOTESAPP_PYTHON (
  if exist "%NOTESAPP_PYTHON%" (
    set "PYTHON_EXE=%NOTESAPP_PYTHON%"
    goto :python_found
  )
)

if exist "%BACKEND_DIR%\.venv\Scripts\python.exe" (
  set "PYTHON_EXE=%BACKEND_DIR%\.venv\Scripts\python.exe"
  goto :python_found
)

if exist "%ROOT%\.venv\Scripts\python.exe" (
  set "PYTHON_EXE=%ROOT%\.venv\Scripts\python.exe"
  goto :python_found
)

if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" (
  set "PYTHON_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
  goto :python_found
)

for /f "delims=" %%P in ('where python 2^>nul') do (
  if not defined PYTHON_EXE set "PYTHON_EXE=%%P"
)

if not defined PYTHON_EXE (
  echo Python was not found. Install Python 3.11+ or set NOTESAPP_PYTHON to python.exe.
  exit /b 1
)

:python_found
echo Python: %PYTHON_EXE%
exit /b 0

:ensure_backend_deps
echo Checking backend dependencies...
"%PYTHON_EXE%" -c "import fastapi, uvicorn, sqlalchemy, pydantic_settings" >nul 2>&1
if not errorlevel 1 exit /b 0

echo Installing backend dependencies from backend\requirements.txt...
pushd "%BACKEND_DIR%" >nul
"%PYTHON_EXE%" -m pip install -r requirements.txt
set "INSTALL_RESULT=%ERRORLEVEL%"
popd >nul
if not "%INSTALL_RESULT%"=="0" (
  echo Backend dependency installation failed.
  exit /b %INSTALL_RESULT%
)
exit /b 0

:ensure_frontend_deps
where npm >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Install Node.js, then run this file again.
  exit /b 1
)

if exist "%FRONTEND_DIR%\node_modules\" exit /b 0

echo Installing frontend dependencies from frontend\package-lock.json...
pushd "%FRONTEND_DIR%" >nul
call npm install
set "INSTALL_RESULT=%ERRORLEVEL%"
popd >nul
if not "%INSTALL_RESULT%"=="0" (
  echo Frontend dependency installation failed.
  exit /b %INSTALL_RESULT%
)
exit /b 0

:start_backend
call :is_port_open %BACKEND_PORT%
if not errorlevel 1 (
  echo Backend port %BACKEND_PORT% is already in use. Reusing the running service.
  exit /b 0
)

echo Starting backend on %BACKEND_URL%...
start "NotesApp Backend" /D "%BACKEND_DIR%" cmd /k ""%PYTHON_EXE%" -m uvicorn app.main:app --host 127.0.0.1 --port %BACKEND_PORT% --reload"
exit /b 0

:start_frontend
call :is_port_open %FRONTEND_PORT%
if not errorlevel 1 (
  echo Frontend port %FRONTEND_PORT% is already in use. Reusing the running service.
  exit /b 0
)

echo Starting frontend on %FRONTEND_URL%...
start "NotesApp Frontend" /D "%FRONTEND_DIR%" cmd /k "npm run dev -- --port %FRONTEND_PORT%"
exit /b 0

:is_port_open
powershell -NoProfile -ExecutionPolicy Bypass -Command "$connections = Get-NetTCPConnection -LocalPort %~1 -State Listen -ErrorAction SilentlyContinue; if ($connections) { exit 0 } exit 1" >nul 2>&1
exit /b %ERRORLEVEL%

:stop_port
powershell -NoProfile -ExecutionPolicy Bypass -Command "$pids = Get-NetTCPConnection -LocalPort %~1 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($pidValue in $pids) { if ($pidValue -gt 0) { Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue } }" >nul 2>&1
echo Stopped %~2 processes on port %~1 if any were running.
exit /b 0

:wait_url
set "LABEL=%~1"
set "URL=%~2"
set "TRIES=%~3"
for /L %%I in (1,1,%TRIES%) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { exit 0 } exit 1 } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 (
    echo %LABEL% is running: %URL%
    exit /b 0
  )
  timeout /t 1 /nobreak >nul
)
echo %LABEL% did not respond at %URL%.
exit /b 1

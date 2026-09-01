@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "BACKEND_DIR=%ROOT%\backend"
set "FRONTEND_DIR=%ROOT%\frontend"
set "RUNTIME_DIR=%ROOT%\.dev-runtime"
set "BACKEND_PID_FILE=%RUNTIME_DIR%\backend.pid"
set "FRONTEND_PID_FILE=%RUNTIME_DIR%\frontend.pid"
set "BACKEND_OUT_LOG=%RUNTIME_DIR%\backend.out.log"
set "BACKEND_ERROR_LOG=%RUNTIME_DIR%\backend.error.log"
set "FRONTEND_OUT_LOG=%RUNTIME_DIR%\frontend.out.log"
set "FRONTEND_ERROR_LOG=%RUNTIME_DIR%\frontend.error.log"
if defined NOTESAPP_BACKEND_PORT (set "BACKEND_PORT=%NOTESAPP_BACKEND_PORT%") else (set "BACKEND_PORT=8000")
if defined NOTESAPP_FRONTEND_PORT (set "FRONTEND_PORT=%NOTESAPP_FRONTEND_PORT%") else (set "FRONTEND_PORT=5173")
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

if /I "%~1"=="help" goto :usage

call :choose_python
if errorlevel 1 exit /b 1

call :select_backend_port
if errorlevel 1 exit /b 1

call :select_frontend_port
if errorlevel 1 exit /b 1

if /I "%~1"=="restart" (
  echo Restart requested. Stopping services on the selected dev ports...
  call :stop_service "%BACKEND_PID_FILE%" %BACKEND_PORT% "NotesApp Backend" "backend"
  call :stop_service "%FRONTEND_PID_FILE%" %FRONTEND_PORT% "NotesApp Frontend" "frontend"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Milliseconds 800" >nul 2>&1
  echo.
)

call :configure_local_environment
if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%" >nul 2>&1

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
call :wait_url "Backend" "%BACKEND_HEALTH_URL%" 35 || set "VERIFY_FAILED=1"
call :wait_url "Frontend" "%FRONTEND_URL%" 35 || set "VERIFY_FAILED=1"
if "%VERIFY_FAILED%"=="0" (
  call :is_notes_backend_running %BACKEND_PORT% || set "VERIFY_FAILED=1"
  call :check_frontend %FRONTEND_PORT% || set "VERIFY_FAILED=1"
)

echo.
if "%VERIFY_FAILED%"=="0" (
  echo Ready.
  echo Frontend: %FRONTEND_URL%
  echo Backend:  %BACKEND_DOCS_URL%
  echo Local DB: %BACKEND_DIR%\notes_app.local.db
  echo Logs:     %RUNTIME_DIR%
  echo.
  echo File change support:
  echo - Frontend runs through Vite, so browser refresh/HMR is automatic.
  echo - Backend runs through uvicorn --reload, so Python changes restart the API.
  echo.
  echo Production settings remain in backend\.env and are not modified by this launcher.
  if /I not "%NOTESAPP_NO_BROWSER%"=="1" start "" "%FRONTEND_URL%"
) else (
  echo One or more services did not respond in time.
  echo Check the "NotesApp Backend" and "NotesApp Frontend" terminal windows for details.
  exit /b 1
)

exit /b 0

:usage
echo Usage:
echo   start-dev.bat          Start or reuse the local NotesApp services
echo   start-dev.bat restart  Restart the selected local services
echo   start-dev.bat help     Show this help
echo.
echo Optional port overrides:
echo   set NOTESAPP_BACKEND_PORT=8001
echo   set NOTESAPP_FRONTEND_PORT=5174
echo.
echo The launcher uses backend\notes_app.local.db and never edits production .env files.
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

:select_backend_port
call :is_port_open %BACKEND_PORT%
if errorlevel 1 goto :backend_port_not_listening
call :is_notes_backend_running %BACKEND_PORT%
if not errorlevel 1 (
  echo Reusing NotesApp backend on port %BACKEND_PORT%.
  goto :backend_port_selected
)
echo Port %BACKEND_PORT% is used by another application. Looking for a local backend port...
goto :find_backend_port

:backend_port_not_listening
call :is_port_bindable %BACKEND_PORT%
if not errorlevel 1 goto :backend_port_selected
echo Windows cannot bind backend port %BACKEND_PORT%. Looking for another port...

:find_backend_port
call :find_free_port %BACKEND_PORT% BACKEND_PORT
if errorlevel 1 (
  echo No usable backend port was found in the next 100 ports.
  exit /b 1
)
echo Using backend port %BACKEND_PORT%.

:backend_port_selected
set "BACKEND_BASE_URL=http://127.0.0.1:%BACKEND_PORT%"
set "BACKEND_HEALTH_URL=%BACKEND_BASE_URL%/health"
set "BACKEND_DOCS_URL=%BACKEND_BASE_URL%/docs"
exit /b 0

:select_frontend_port
call :is_port_open %FRONTEND_PORT%
if errorlevel 1 goto :frontend_port_not_listening
call :check_frontend %FRONTEND_PORT%
if not errorlevel 1 (
  echo Reusing NotesApp frontend on port %FRONTEND_PORT%.
  goto :frontend_port_selected
)
echo Port %FRONTEND_PORT% is used by another application. Looking for a local frontend port...
goto :find_frontend_port

:frontend_port_not_listening
call :is_port_bindable %FRONTEND_PORT%
if not errorlevel 1 goto :frontend_port_selected
echo Windows cannot bind frontend port %FRONTEND_PORT%. Looking for another port...

:find_frontend_port
call :find_free_port %FRONTEND_PORT% FRONTEND_PORT
if errorlevel 1 (
  echo No usable frontend port was found in the next 100 ports.
  exit /b 1
)
echo Using frontend port %FRONTEND_PORT%.

:frontend_port_selected
set "FRONTEND_URL=http://127.0.0.1:%FRONTEND_PORT%/"
exit /b 0

:configure_local_environment
rem These values apply only to processes launched by this local batch file.
rem backend\.env remains the production source of truth for deployments.
set "ENVIRONMENT=development"
set "DATABASE_URL=sqlite:///./notes_app.local.db"
set "UPLOAD_DIR=storage/local-uploads"
set "ALLOWED_HOSTS=127.0.0.1,localhost"
set "CORS_ORIGINS=http://127.0.0.1:%FRONTEND_PORT%,http://localhost:%FRONTEND_PORT%"
set "FRONTEND_URL=http://127.0.0.1:%FRONTEND_PORT%"
set "VITE_API_URL=%BACKEND_BASE_URL%"
if not exist "%BACKEND_DIR%\storage\local-uploads" mkdir "%BACKEND_DIR%\storage\local-uploads" >nul 2>&1
echo Local runtime: development environment with an isolated SQLite database.
exit /b 0

:ensure_backend_deps
echo Checking backend dependencies...
pushd "%BACKEND_DIR%" >nul
"%PYTHON_EXE%" -c "import app.main, fastapi, uvicorn, sqlalchemy, pydantic_settings" >nul 2>&1
set "DEPENDENCY_RESULT=%ERRORLEVEL%"
popd >nul
if "%DEPENDENCY_RESULT%"=="0" exit /b 0

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

if exist "%FRONTEND_DIR%\node_modules\" (
  pushd "%FRONTEND_DIR%" >nul
  call npm ls --depth=0 >nul 2>&1
  set "DEPENDENCY_RESULT=%ERRORLEVEL%"
  popd >nul
  if "!DEPENDENCY_RESULT!"=="0" exit /b 0
  echo Frontend dependencies are incomplete. Repairing them...
)

echo Installing frontend dependencies from frontend\package-lock.json...
pushd "%FRONTEND_DIR%" >nul
if exist "package-lock.json" (call npm ci) else (call npm install)
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
  call :is_notes_backend_running %BACKEND_PORT%
  if not errorlevel 1 (
    echo Backend is already running on %BACKEND_BASE_URL%.
    exit /b 0
  )
  echo Backend port %BACKEND_PORT% became unavailable before startup.
  exit /b 1
)

echo Starting backend on %BACKEND_BASE_URL%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$arguments = @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '%BACKEND_PORT%', '--reload'); $process = Start-Process -FilePath '%PYTHON_EXE%' -ArgumentList $arguments -WorkingDirectory '%BACKEND_DIR%' -WindowStyle Hidden -RedirectStandardOutput '%BACKEND_OUT_LOG%' -RedirectStandardError '%BACKEND_ERROR_LOG%' -PassThru; Set-Content -LiteralPath '%BACKEND_PID_FILE%' -Value $process.Id"
if errorlevel 1 (
  echo Backend process could not be launched. Check %BACKEND_ERROR_LOG%.
  exit /b 1
)
exit /b 0

:start_frontend
call :is_port_open %FRONTEND_PORT%
if not errorlevel 1 (
  call :check_frontend %FRONTEND_PORT%
  if not errorlevel 1 (
    echo Frontend is already running on %FRONTEND_URL%.
    exit /b 0
  )
  echo Frontend port %FRONTEND_PORT% became unavailable before startup.
  exit /b 1
)

echo Starting frontend on %FRONTEND_URL%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$arguments = @('/d', '/c', 'npm run dev -- --port %FRONTEND_PORT%'); $process = Start-Process -FilePath 'cmd.exe' -ArgumentList $arguments -WorkingDirectory '%FRONTEND_DIR%' -WindowStyle Hidden -RedirectStandardOutput '%FRONTEND_OUT_LOG%' -RedirectStandardError '%FRONTEND_ERROR_LOG%' -PassThru; Set-Content -LiteralPath '%FRONTEND_PID_FILE%' -Value $process.Id"
if errorlevel 1 (
  echo Frontend process could not be launched. Check %FRONTEND_ERROR_LOG%.
  exit /b 1
)
exit /b 0

:is_port_open
powershell -NoProfile -ExecutionPolicy Bypass -Command "$client = [Net.Sockets.TcpClient]::new(); try { $pending = $client.ConnectAsync('127.0.0.1', %~1); if ($pending.Wait(750) -and $client.Connected) { exit 0 } exit 1 } catch { exit 1 } finally { $client.Dispose() }" >nul 2>&1
exit /b %ERRORLEVEL%

:is_port_bindable
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, %~1); $listener.Start(); $listener.Stop(); exit 0 } catch { exit 1 }" >nul 2>&1
exit /b %ERRORLEVEL%

:is_notes_backend_running
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $response = Invoke-RestMethod -Uri 'http://127.0.0.1:%~1/' -TimeoutSec 2; if ($response.status -eq 'ok' -and $response.name -eq 'Notion Style Notes') { exit 0 } exit 1 } catch { exit 1 }" >nul 2>&1
exit /b %ERRORLEVEL%

:check_frontend
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%~1/' -TimeoutSec 2; if ($response.StatusCode -eq 200 -and $response.Content -match 'title.Notes./title' -and $response.Content -match 'src=./src/main.tsx') { exit 0 } exit 1 } catch { exit 1 }" >nul 2>&1
exit /b %ERRORLEVEL%

:find_free_port
set "%~2="
for /f "delims=" %%P in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$start = %~1; foreach ($port in $start..($start + 99)) { try { $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port); $listener.Start(); $listener.Stop(); Write-Output $port; break } catch {} }"') do set "%~2=%%P"
if not defined %~2 exit /b 1
exit /b 0

:stop_port
powershell -NoProfile -ExecutionPolicy Bypass -Command "$pattern = '^\s*TCP\s+\S+:%~1\s+\S+\s+LISTENING\s+(\d+)\s*$'; $pids = netstat -ano -p tcp | ForEach-Object { if ($_ -match $pattern) { [int]$Matches[1] } } | Sort-Object -Unique; foreach ($pidValue in $pids) { if ($pidValue -le 0) { continue }; $spawnPattern = 'parent_pid=' + $pidValue; Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match [regex]::Escape($spawnPattern) } | ForEach-Object { taskkill.exe /PID $_.ProcessId /T /F | Out-Null }; try { $process = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $pidValue) -ErrorAction Stop; $parent = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $process.ParentProcessId) -ErrorAction Stop; if ($parent.Name -in @('python.exe', 'pythonw.exe', 'node.exe', 'cmd.exe')) { taskkill.exe /PID $parent.ProcessId /T /F | Out-Null } } catch {}; Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue }" >nul 2>&1
echo Stopped %~2 processes on port %~1 if any were running.
exit /b 0

:stop_service
set "SERVICE_PID="
if exist "%~1" (
  for /f "usebackq delims=" %%P in ("%~1") do set "SERVICE_PID=%%P"
)
if defined SERVICE_PID taskkill /PID !SERVICE_PID! /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq %~3" /T /F >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "$kind = '%~4'; $port = '%~2'; if ($kind -eq 'backend') { $pattern = 'uvicorn\s+app\.main:app.*--port\s+' + $port } else { $pattern = '(npm\s+run\s+dev|vite\s+--host).*--port\s+' + $port }; Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match $pattern } | ForEach-Object { taskkill.exe /PID $_.ProcessId /T /F | Out-Null }" >nul 2>&1
if exist "%~1" del /q "%~1" >nul 2>&1
call :stop_port %~2 "%~4"
exit /b 0

:wait_url
set "LABEL=%~1"
set "URL=%~2"
set "TRIES=%~3"
for /L %%I in (1,1,%TRIES%) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { exit 0 } exit 1 } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 (
    echo %LABEL% is running: %URL%
    exit /b 0
  )
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Milliseconds 800" >nul 2>&1
)
echo %LABEL% did not respond at %URL%.
exit /b 1

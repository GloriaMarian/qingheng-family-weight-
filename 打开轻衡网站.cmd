@echo off
setlocal
pushd "%~dp0"

set "RUNTIME_ROOT=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies"
set "NODE_DIR=%RUNTIME_ROOT%\node\bin"
set "PNPM_CMD=%RUNTIME_ROOT%\bin\fallback\pnpm.cmd"

if not exist "%NODE_DIR%\node.exe" goto missing_runtime
if not exist "%PNPM_CMD%" goto missing_runtime

set "PATH=%NODE_DIR%;%PATH%"

curl.exe --silent --fail "http://localhost:3000/" >nul 2>&1 && goto open_site
start "Qingheng Local Server" cmd /k call "%PNPM_CMD%" dev

for /l %%I in (1,1,30) do (
  curl.exe --silent --fail "http://localhost:3000/" >nul 2>&1 && goto open_site
  timeout /t 1 /nobreak >nul
)

:open_site
start "" "http://localhost:3000/"

goto finish

:missing_runtime
echo Qingheng could not find the local Node.js runtime.
echo Open this project in Codex and ask Codex to start the website.
pause

:finish
popd
endlocal

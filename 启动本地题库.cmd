@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if not errorlevel 1 goto use_python

where py >nul 2>nul
if not errorlevel 1 goto use_py

echo Python 3 was not found.
pause
exit /b 1

:use_python
start "Quiz server" /min python -m http.server 8000
goto open_browser

:use_py
start "Quiz server" /min py -m http.server 8000

:open_browser
timeout /t 1 /nobreak >nul
start "" http://localhost:8000/
exit /b 0

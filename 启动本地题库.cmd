@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "题库本地服务器" /min py -m http.server 8000
  timeout /t 1 /nobreak >nul
  start "" http://localhost:8000/
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "题库本地服务器" /min python -m http.server 8000
  timeout /t 1 /nobreak >nul
  start "" http://localhost:8000/
  goto :eof
)
echo 未找到 Python。请安装 Python 3 后重新双击此文件。
pause

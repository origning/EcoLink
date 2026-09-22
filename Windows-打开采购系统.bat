@echo off
rem Use UTF-8 so Chinese text below prints correctly (not mojibake).
chcp 65001 >nul 2>&1
setlocal EnableExtensions
if /I not "%~1"=="_RUN" (
  cmd /c "%~f0" _RUN
  echo.
  echo Window stays open so you can read the message.
  echo 窗口会停住，方便查看上面的说明或报错。
  pause
  exit /b %ERRORLEVEL%
)

cd /d "%~dp0"
if errorlevel 1 (
  echo [ERROR] Cannot open project folder:
  echo %~dp0
  exit /b 1
)

echo Checking Windows runtime...
echo 正在检查 Windows 运行环境...
echo.

set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" (
  echo [ERROR] PowerShell not found:
  echo %PS%
  echo Please run Windows-安装运行环境.bat first, or install Node.js 20+ from https://nodejs.org
  exit /b 1
)

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-node.ps1"
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js is not ready.
  echo 未准备好 Node.js。请先双击「Windows-安装运行环境.bat」，完成后再打开网站。
  exit /b 1
)

set "PATH=%~dp0tools\node;C:\Program Files\nodejs;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] node.exe not found.
  echo 仍未找到 node。请先运行「Windows-安装运行环境.bat」。
  exit /b 1
)

set "NEED_INSTALL=0"
if not exist "node_modules\" set "NEED_INSTALL=1"
if not exist "node_modules\.bin\vite.cmd" set "NEED_INSTALL=1"
if not exist "node_modules\vite\bin\vite.js" set "NEED_INSTALL=1"
if "%NEED_INSTALL%"=="1" (
  echo.
  echo Installing npm dependencies for Windows...
  echo 正在为 Windows 安装依赖。从 Mac 拷来的 node_modules 不能直接用。
  echo.
  call npm.cmd install --legacy-peer-deps
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed.
    echo 依赖安装失败。请确认能访问互联网后再试。
    exit /b 1
  )
)

echo.
echo Starting EcoLink...
echo 正在启动 EcoLink...
echo Computer browser will open http://localhost:5173
echo 电脑浏览器会自动打开 http://localhost:5173
echo Phone on the same Wi-Fi:
echo 手机请连同一 Wi-Fi，用浏览器打开：
node "%~dp0scripts\print-lan-urls.cjs"
echo Keep this window open. Closing it stops the website.
echo 请保持本窗口开启。关闭窗口即停止网站。
echo.
call npm.cmd start
echo.
echo Website stopped.
echo 网站已停止。
exit /b %ERRORLEVEL%

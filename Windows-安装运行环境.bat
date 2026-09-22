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

echo ============================================
echo   Windows - Install runtime
echo   Windows - 安装运行环境
echo ============================================
echo.
echo Checking / installing Node.js LTS from https://nodejs.org
echo 正在检查并安装 Node.js LTS，来源只有官网。
echo.

set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" (
  echo [ERROR] PowerShell not found:
  echo %PS%
  echo Windows 自带的 PowerShell 丢失，无法自动安装 Node.js。
  exit /b 1
)

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-node.ps1" -PreferSystem
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js is not ready.
  echo 环境未就绪，网站还不能打开。
  exit /b 1
)

echo.
echo Runtime is ready. Next: double-click Windows-打开采购系统.bat
echo 环境已准备好。下一步请双击「Windows-打开采购系统.bat」。
exit /b 0

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

set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" (
  echo [ERROR] PowerShell not found.
  echo 请手动把「Windows-安装运行环境.bat」和「Windows-打开采购系统.bat」发送到桌面。
  exit /b 1
)

"%PS%" -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $desktop = [Environment]::GetFolderPath('Desktop'); $here = (Get-Location).Path; $a = $ws.CreateShortcut((Join-Path $desktop 'Windows-安装运行环境.lnk')); $a.TargetPath = (Join-Path $here 'Windows-安装运行环境.bat'); $a.WorkingDirectory = $here; $a.Description = 'Windows: install Node.js LTS'; $a.Save(); $b = $ws.CreateShortcut((Join-Path $desktop 'Windows-打开采购系统.lnk')); $b.TargetPath = (Join-Path $here 'Windows-打开采购系统.bat'); $b.WorkingDirectory = $here; $b.Description = 'Windows: open EcoLink'; $b.Save()"
if errorlevel 1 (
  echo Shortcut creation failed.
  echo 自动创建失败。请手动把「Windows-安装运行环境.bat」和「Windows-打开采购系统.bat」发送到桌面。
  exit /b 1
)

echo Desktop shortcuts created:
echo 已在桌面创建两个 Windows 快捷方式：
echo   Windows-安装运行环境   first-time setup
echo   Windows-打开采购系统   open the website
exit /b 0

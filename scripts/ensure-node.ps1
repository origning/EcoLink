param(
  [switch]$PreferSystem
)

$ErrorActionPreference = "Stop"
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}
$Root = Split-Path -Parent $PSScriptRoot
$PortableDir = Join-Path $Root "tools\node"
$MinMajor = 20

function Write-Step([string]$Message) {
  Write-Host $Message
}

function Refresh-UserPath {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$PortableDir;C:\Program Files\nodejs;$machine;$user"
}

function Get-NodeMajor([string]$Command) {
  try {
    $raw = & $Command -v 2>$null
    if ($raw -match "v(\d+)\.") { return [int]$Matches[1] }
  } catch {}
  return 0
}

function Test-UsableNode {
  Refresh-UserPath
  $portable = Join-Path $PortableDir "node.exe"
  if (Test-Path $portable) {
    $major = Get-NodeMajor $portable
    if ($major -ge $MinMajor) {
      $env:Path = "$PortableDir;$env:Path"
      return $true
    }
  }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) {
    $major = Get-NodeMajor $cmd.Source
    if ($major -ge $MinMajor) { return $true }
  }
  return $false
}

function Get-LtsInfo {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $index = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json"
  $lts = $index | Where-Object { $_.lts } | Select-Object -First 1
  if (-not $lts) { throw "无法从 nodejs.org 读取 LTS 版本" }
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
  return [pscustomobject]@{
    Version = $lts.version
    Arch    = $arch
  }
}

function Install-PortableNode {
  $info = Get-LtsInfo
  $zipName = "node-$($info.Version)-win-$($info.Arch).zip"
  $url = "https://nodejs.org/dist/$($info.Version)/$zipName"
  $temp = Join-Path $env:TEMP $zipName
  $unpack = Join-Path $env:TEMP ("node-lts-" + [guid]::NewGuid().ToString("N"))

  Write-Step "正在从 nodejs.org 下载 Node.js $($info.Version) LTS（便携版，无需管理员）..."
  Invoke-WebRequest -Uri $url -OutFile $temp

  Write-Step "正在解压到 tools\node ..."
  if (Test-Path $unpack) { Remove-Item $unpack -Recurse -Force }
  Expand-Archive -Path $temp -DestinationPath $unpack -Force
  $inner = Get-ChildItem $unpack -Directory | Select-Object -First 1
  if (-not $inner) { throw "解压 Node.js 失败" }

  New-Item -ItemType Directory -Force -Path (Split-Path $PortableDir) | Out-Null
  if (Test-Path $PortableDir) { Remove-Item $PortableDir -Recurse -Force }
  Move-Item $inner.FullName $PortableDir
  Remove-Item $temp -Force -ErrorAction SilentlyContinue
  Remove-Item $unpack -Recurse -Force -ErrorAction SilentlyContinue
}

function Install-SystemNode {
  $info = Get-LtsInfo
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Step "正在用 Windows winget 安装官方 Node.js LTS..."
    winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
    Refresh-UserPath
    if (Test-UsableNode) { return $true }
  }

  $msiName = "node-$($info.Version)-$($info.Arch).msi"
  $url = "https://nodejs.org/dist/$($info.Version)/$msiName"
  $msi = Join-Path $env:TEMP $msiName
  Write-Step "正在下载官方安装包 $($info.Version) ..."
  Invoke-WebRequest -Uri $url -OutFile $msi
  Write-Step "即将打开 Node.js 安装程序。请按提示完成安装（需允许管理员权限）。"
  $code = (Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$msi`" /passive /norestart" -Wait -PassThru).ExitCode
  Refresh-UserPath
  return (Test-UsableNode -or $code -eq 0)
}

if (Test-UsableNode) {
  $ver = (node -v)
  Write-Step "已检测到 Node.js $ver ，可以直接打开网站。"
  exit 0
}

try {
  if ($PreferSystem) {
    $ok = $false
    try { $ok = Install-SystemNode } catch { Write-Step $_.Exception.Message }
    if (-not $ok -and -not (Test-UsableNode)) {
      Write-Step "系统安装未完成，改为安装便携版 Node.js LTS。"
      Install-PortableNode
    }
  } else {
    Install-PortableNode
  }
  Refresh-UserPath
  if (-not (Test-UsableNode)) { throw "安装后仍未检测到 Node.js" }
  Write-Step "Node.js $((node -v)) 已就绪。"
  exit 0
} catch {
  Write-Step "[错误] $($_.Exception.Message)"
  Write-Step "请检查网络后重试，或手动打开 https://nodejs.org 下载 LTS。"
  exit 1
}

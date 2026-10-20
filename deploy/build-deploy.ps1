# Build the versioned deployment package locally (Windows).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File deploy\build-deploy.ps1
#
# Output:
#   deploy\out\ecolink-deploy-v<version>-<timestamp>.tar.gz
#   deploy\out\ecolink-deploy.tar.gz              (copy of the latest package)
#   deploy\out\version.json                       (version manifest)
#   deploy\out\VERSION                            (human-readable version)
#   deploy\out\server.cjs
#   deploy\out\dist\
#
# NOTE: keep this file ASCII-only. Windows PowerShell reads scripts using the
# system codepage; non-ASCII text here can break parsing on Chinese Windows.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==> [1/5] Build frontend (npm run build:web)"
npm run build:web
if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }

Write-Host "==> [2/5] Bundle server entry (esbuild)"
New-Item -ItemType Directory -Force -Path "deploy\out" | Out-Null
npx esbuild deploy/entry.ts --bundle --platform=node --format=cjs --outfile=deploy/out/server.cjs
if ($LASTEXITCODE -ne 0) { throw "server bundle failed" }

Write-Host "==> [3/5] Write version manifest"
$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$version = $pkg.version
$buildTime = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssK")
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$gitCommit = "unknown"
$gitBranch = "unknown"
$gitDirty = $false
try { $gitCommit = (git rev-parse --short HEAD).Trim() } catch {}
try { $gitBranch = (git rev-parse --abbrev-ref HEAD).Trim() } catch {}
try {
  $status = git status --porcelain
  if ($status) { $gitDirty = $true }
} catch {}

$manifest = [ordered]@{
  name = "ecolink-procurement"
  version = $version
  buildTime = $buildTime
  gitCommit = $gitCommit
  gitBranch = $gitBranch
  gitDirty = $gitDirty
} | ConvertTo-Json

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $root "deploy\out\version.json"), $manifest, $utf8NoBom)

$dirtyText = if ($gitDirty) { " (dirty)" } else { "" }
$versionText = @(
  "EcoLink $version",
  "Build: $buildTime",
  "Commit: $gitCommit$dirtyText",
  "Branch: $gitBranch"
) -join "`n"
[System.IO.File]::WriteAllText((Join-Path $root "deploy\out\VERSION"), $versionText, $utf8NoBom)

Write-Host "    version: $version"
Write-Host "    commit:  $gitCommit$dirtyText"
Write-Host "    build:   $buildTime"

Write-Host "==> [4/5] Collect deployment files"
if (Test-Path "deploy\out\dist") { Remove-Item -Recurse -Force "deploy\out\dist" }
Copy-Item -Recurse "dist" "deploy\out\dist"
Copy-Item "deploy\ecosystem.config.cjs" "deploy\out\ecosystem.config.cjs" -Force
Copy-Item "deploy\nginx-ecolink.conf" "deploy\out\nginx-ecolink.conf" -Force
Copy-Item "deploy\backup.sh" "deploy\out\backup.sh" -Force
Copy-Item "deploy\restore.sh" "deploy\out\restore.sh" -Force
Copy-Item "deploy\update.sh" "deploy\out\update.sh" -Force
Copy-Item "deploy\rollback.sh" "deploy\out\rollback.sh" -Force

Write-Host "==> [5/5] Create versioned tar.gz package"
$packageName = "ecolink-deploy-v$version-$stamp.tar.gz"
$packagePath = "deploy\out\$packageName"
if (Test-Path $packagePath) { Remove-Item $packagePath -Force }
tar -czf $packagePath -C deploy/out dist server.cjs ecosystem.config.cjs nginx-ecolink.conf backup.sh restore.sh update.sh rollback.sh version.json VERSION
if ($LASTEXITCODE -ne 0) { throw "package build failed" }

Copy-Item $packagePath "deploy\out\ecolink-deploy.tar.gz" -Force

Write-Host ""
Write-Host "Version: $version"
Write-Host "Package: $packagePath"
Write-Host "Latest:   deploy\out\ecolink-deploy.tar.gz"
Write-Host ""
Write-Host "Upload with:"
Write-Host "  scp $packagePath ubuntu@43.129.217.109:/home/ubuntu/"
Write-Host "Then on the server:"
Write-Host "  bash /opt/ecolink/update.sh /home/ubuntu/$packageName"

# Build the deployment package locally (Windows).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File deploy\build-deploy.ps1
#
# Output:
#   deploy\out\dist\                frontend static files
#   deploy\out\server.cjs           bundled Node server entry
#   deploy\out\ecosystem.config.cjs PM2 config
#   deploy\out\nginx-ecolink.conf   Nginx site config
#   deploy\out\ecolink-deploy.tar.gz upload package
#                                    NOTE: use tar.gz, not zip. Windows Compress-Archive
#                                    writes backslash paths that break Linux unzip.
#
# NOTE: keep this file ASCII-only. Windows PowerShell reads scripts using the
# system codepage; non-ASCII text here can break parsing on Chinese Windows.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==> [1/4] Build frontend (npm run build:web)"
npm run build:web

Write-Host "==> [2/4] Bundle server entry (esbuild)"
New-Item -ItemType Directory -Force -Path "deploy\out" | Out-Null
npx esbuild deploy/entry.ts --bundle --platform=node --format=cjs --outfile=deploy/out/server.cjs

Write-Host "==> [3/4] Collect deployment files"
if (Test-Path "deploy\out\dist") { Remove-Item -Recurse -Force "deploy\out\dist" }
Copy-Item -Recurse "dist" "deploy\out\dist"
Copy-Item "deploy\ecosystem.config.cjs" "deploy\out\ecosystem.config.cjs" -Force
Copy-Item "deploy\nginx-ecolink.conf" "deploy\out\nginx-ecolink.conf" -Force
Copy-Item "deploy\backup.sh" "deploy\out\backup.sh" -Force
Copy-Item "deploy\restore.sh" "deploy\out\restore.sh" -Force

Write-Host "==> [4/4] Create tar.gz package"
if (Test-Path "deploy\out\ecolink-deploy.tar.gz") { Remove-Item "deploy\out\ecolink-deploy.tar.gz" -Force }
tar -czf deploy/out/ecolink-deploy.tar.gz -C deploy/out dist server.cjs ecosystem.config.cjs nginx-ecolink.conf backup.sh restore.sh

Write-Host ""
Write-Host "Done. See: deploy\out\ and deploy\out\ecolink-deploy.tar.gz"

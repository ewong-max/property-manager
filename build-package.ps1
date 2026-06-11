#Requires -Version 5.1
<#
.SYNOPSIS
  Builds a standalone Windows executable for Property Manager.
  Output: release\PropertyManager\  (zip this folder to share)
#>

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$serverDir   = "$projectRoot\server"
$clientDir   = "$projectRoot\client"
$releaseDir  = "$projectRoot\release\PropertyManager"

# ── Clean release folder ─────────────────────────────────────────────────────
Write-Host "`n[1/8] Cleaning release folder..." -ForegroundColor Cyan
if (Test-Path $releaseDir) { Remove-Item $releaseDir -Recurse -Force }
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

# ── Build React client ───────────────────────────────────────────────────────
Write-Host "[2/8] Building React client..." -ForegroundColor Cyan
Set-Location $clientDir
npm run build
if ($LASTEXITCODE -ne 0) { throw "React build failed" }

# Copy build output into release\PropertyManager\public\
Write-Host "      Copying React build to release..." -ForegroundColor Gray
Copy-Item "$clientDir\dist" "$releaseDir\public" -Recurse

# ── Install server deps (including @yao-pkg/pkg) ─────────────────────────────
Write-Host "[3/8] Installing server dependencies..." -ForegroundColor Cyan
Set-Location $serverDir
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

# ── Regenerate Prisma client with Windows binary target ──────────────────────
Write-Host "[4/8] Generating Prisma client (Windows binary)..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) { throw "prisma generate failed" }

# ── Compile TypeScript ───────────────────────────────────────────────────────
Write-Host "[5/8] Compiling TypeScript..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "TypeScript compilation failed" }

# ── Bundle exe with pkg ──────────────────────────────────────────────────────
Write-Host "[6/8] Packaging with @yao-pkg/pkg (this may take a minute)..." -ForegroundColor Cyan
npx pkg entrypoint.js `
    --target node20-win-x64 `
    --output "$releaseDir\PropertyManager.exe" `
    --config package.json
if ($LASTEXITCODE -ne 0) { throw "pkg packaging failed" }

# ── Copy Prisma query-engine binary ──────────────────────────────────────────
Write-Host "[7/8] Copying Prisma engine binary..." -ForegroundColor Cyan
$prismaClientDir = "$serverDir\node_modules\.prisma\client"
$engineFiles = Get-ChildItem $prismaClientDir -Filter "*.node" -ErrorAction SilentlyContinue
if ($engineFiles.Count -eq 0) {
  # Fallback: search broader path
  $engineFiles = Get-ChildItem "$serverDir\node_modules" -Filter "*query_engine*windows*" -Recurse -ErrorAction SilentlyContinue
}
if ($engineFiles.Count -eq 0) {
  Write-Warning "Could not find Prisma engine binary (.node file). Check node_modules\.prisma\client\"
} else {
  foreach ($f in $engineFiles) {
    Write-Host "      Copying $($f.Name)..." -ForegroundColor Gray
    Copy-Item $f.FullName $releaseDir
  }
}

# ── Create fresh empty database (schema only, no seed data) ──────────────────
Write-Host "[8/8] Creating fresh database (no test data)..." -ForegroundColor Cyan
$env:DATABASE_URL = "file:$releaseDir\data.db"
npx prisma db push --skip-generate --force-reset
if ($LASTEXITCODE -ne 0) { throw "prisma db push failed" }
Remove-Item Env:DATABASE_URL

# ── Create uploads folder ────────────────────────────────────────────────────
New-Item -ItemType Directory -Path "$releaseDir\uploads" -Force | Out-Null
New-Item -ItemType Directory -Path "$releaseDir\uploads\tmp" -Force | Out-Null

# ── Write config.env template ────────────────────────────────────────────────
@"
# Property Manager - Configuration
# Edit this file to change settings, then restart PropertyManager.exe

PIN=1234
PORT=3001
GEMINI_API_KEY=
"@ | Out-File "$releaseDir\config.env" -Encoding utf8

# ── Summary ──────────────────────────────────────────────────────────────────
Write-Host "`n✅ Build complete!" -ForegroundColor Green
Write-Host "   Output folder : $releaseDir" -ForegroundColor Green
Write-Host "   To distribute : zip the PropertyManager folder and share it" -ForegroundColor Green
Write-Host ""
Write-Host "Contents:" -ForegroundColor Yellow
Get-ChildItem $releaseDir | ForEach-Object {
  $size = if ($_.PSIsContainer) { "(folder)" } else { "$([math]::Round($_.Length/1MB, 1)) MB" }
  Write-Host "   $($_.Name)  $size"
}
Write-Host ""

# Windows-Variante des Deploy-Skripts (PowerShell).
# Aufruf:  $env:BUCKET="mein-bucket"; $env:DISTRIBUTION="E123ABC"; .\deploy\deploy-s3.ps1
$ErrorActionPreference = "Stop"
if (-not $env:BUCKET) { throw "BUCKET setzen" }
if (-not $env:DISTRIBUTION) { throw "DISTRIBUTION setzen" }
$prefix = if ($env:PREFIX) { $env:PREFIX } else { "" }
Set-Location (Join-Path $PSScriptRoot "..")
npm ci; if ($LASTEXITCODE) { exit 1 }
npm test; if ($LASTEXITCODE) { exit 1 }
npm run build; if ($LASTEXITCODE) { exit 1 }
aws s3 sync dist/assets "s3://$($env:BUCKET)/$($prefix)assets" --delete --cache-control "public, max-age=31536000, immutable"
aws s3 sync dist "s3://$($env:BUCKET)/$prefix" --delete --exclude "assets/*" --cache-control "no-cache, no-store, must-revalidate"
aws s3 cp dist/manifest.webmanifest "s3://$($env:BUCKET)/$($prefix)manifest.webmanifest" --content-type "application/manifest+json" --cache-control "no-cache"
aws s3 cp dist/sw.js "s3://$($env:BUCKET)/$($prefix)sw.js" --content-type "text/javascript; charset=utf-8" --cache-control "no-cache, no-store, must-revalidate"
aws cloudfront create-invalidation --distribution-id $env:DISTRIBUTION --paths "/$($prefix)index.html" "/$($prefix)sw.js" "/$($prefix)manifest.webmanifest" "/$prefix" | Out-Null
Write-Host "Fertig."

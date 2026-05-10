# Daily Audible refresh — invoked by Windows Task Scheduler.
# Pulls latest, refreshes books.json from Audible API, commits & pushes if changed.

$ErrorActionPreference = 'Stop'
$repo = 'C:\code\dornosaur'
$logDir = Join-Path $repo 'scripts\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ("update-books-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))

function Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $logFile -Value $line
  Write-Output $line
}

try {
  Set-Location $repo
  Log "=== Starting Audible refresh ==="

  Log "git pull"
  git pull --ff-only 2>&1 | Tee-Object -FilePath $logFile -Append

  Log "node scripts/update-books-fresh.mjs"
  node scripts/update-books-fresh.mjs 2>&1 | Tee-Object -FilePath $logFile -Append
  if ($LASTEXITCODE -ne 0) { throw "Audible script failed with exit code $LASTEXITCODE" }

  $changed = git status --porcelain src/data/books.json
  if ($changed) {
    Log "books.json changed — committing"
    git add src/data/books.json
    git commit -m "chore(books): auto-refresh from Audible" 2>&1 | Tee-Object -FilePath $logFile -Append
    git push 2>&1 | Tee-Object -FilePath $logFile -Append
    Log "Pushed."
  } else {
    Log "No changes to books.json."
  }

  Log "=== Done ==="
} catch {
  Log "ERROR: $_"
  exit 1
}

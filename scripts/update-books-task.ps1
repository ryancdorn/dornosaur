# Daily Audible refresh - invoked by Windows Task Scheduler.
# Pulls latest, refreshes books.json from Audible API, commits & pushes if changed.

$repo = 'C:\code\dornosaur'
$logDir = Join-Path $repo 'scripts\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ("update-books-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))

function Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $logFile -Value $line
  Write-Output $line
}

function Run($label, [scriptblock]$cmd) {
  Log $label
  $output = & $cmd 2>&1 | Out-String
  if ($output) { Add-Content -Path $logFile -Value $output.TrimEnd() }
  if ($LASTEXITCODE -ne 0) {
    Log "FAILED: $label (exit $LASTEXITCODE)"
    exit 1
  }
}

Set-Location $repo
Log "=== Starting Audible refresh ==="

Run "git pull --ff-only"            { git pull --ff-only }
Run "node scripts/update-books-fresh.mjs" { node scripts/update-books-fresh.mjs }

$changed = git status --porcelain src/data/books.json
if ($changed) {
  Log "books.json changed - committing"
  Run "git add" { git add src/data/books.json }
  Run "git commit" { git commit -m "chore(books): auto-refresh from Audible" }
  Run "git push" { git push }
  Log "Pushed."
} else {
  Log "No changes to books.json."
}

Log "=== Done ==="

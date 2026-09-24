<#
  Caption Sidecar Autosave Watcher
  Watches src/content/_studio/*.json and auto-commits (+pushes) on change.
  Design notes:
   - Polls every 3s, requires 2 stable reads before committing (avoids mid-write snapshots)
   - Validates JSON parses before committing (never commits a truncated file)
   - Stages ONLY the sidecar dir -- never `git add -A` (repo has CRLF noise in MDX)
   - Push failures are non-fatal; the local commit is already the safety net
#>

$ErrorActionPreference = 'Continue'
$Repo     = 'C:\Users\seanm\projects\seanmelotti-portfolio'
$Watch    = Join-Path $Repo 'src\content\_studio'
$LogFile  = Join-Path $Repo '.cerebro-tools\autosave.log'
$PollSec  = 3
$PushEvery = 5           # push at most once per 5 commits OR on idle flush
$commitsSincePush = 0

function Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -LiteralPath $LogFile -Value $line -Encoding utf8
}

function Get-StateHash {
  $files = Get-ChildItem -LiteralPath $Watch -Filter '*.json' -File -ErrorAction SilentlyContinue | Sort-Object Name
  if (-not $files) { return $null }
  $sb = New-Object System.Text.StringBuilder
  foreach ($f in $files) {
    try {
      $h = (Get-FileHash -LiteralPath $f.FullName -Algorithm MD5 -ErrorAction Stop).Hash
      [void]$sb.Append($f.Name).Append(':').Append($h).Append(';')
    } catch { return $null }   # file locked mid-write -> treat as unstable
  }
  return $sb.ToString()
}

function Test-SidecarsValid {
  $files = Get-ChildItem -LiteralPath $Watch -Filter '*.json' -File -ErrorAction SilentlyContinue
  foreach ($f in $files) {
    try {
      $raw = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction Stop
      if ([string]::IsNullOrWhiteSpace($raw)) { return $false }
      $null = $raw | ConvertFrom-Json -ErrorAction Stop
    } catch { return $false }
  }
  return $true
}

function Get-Progress {
  # Returns "captions X/Y" across all sidecars
  $done = 0; $total = 0
  $files = Get-ChildItem -LiteralPath $Watch -Filter '*.json' -File -ErrorAction SilentlyContinue
  foreach ($f in $files) {
    try {
      $o = Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json
      foreach ($p in $o.photos) {
        $total++
        if ($p.caption -and $p.caption.Trim().Length -gt 0) { $done++ }
      }
    } catch { }
  }
  return "$done/$total"
}

Set-Location -LiteralPath $Repo
Log "watcher START (pid $PID) watching $Watch"

$lastHash    = Get-StateHash
$pendingHash = $null

while ($true) {
  Start-Sleep -Seconds $PollSec
  $cur = Get-StateHash
  if ($null -eq $cur) { continue }                      # unreadable/locked, retry

  if ($cur -ne $lastHash) {
    if ($pendingHash -ne $cur) { $pendingHash = $cur; continue }   # wait for stability

    # Stable change detected
    if (-not (Test-SidecarsValid)) { Log "SKIP: sidecar JSON invalid, waiting"; $pendingHash = $null; continue }

    & git -C $Repo add -- 'src/content/_studio' 2>&1 | Out-Null
    & git -C $Repo diff --cached --quiet -- 'src/content/_studio'
    if ($LASTEXITCODE -eq 0) { $lastHash = $cur; $pendingHash = $null; continue }  # no real change

    $prog = Get-Progress
    $msg  = "autosave(studio): captions $prog"
    & git -C $Repo commit -m $msg --only -- 'src/content/_studio' 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $sha = (& git -C $Repo rev-parse --short HEAD).Trim()
      Log "COMMIT $sha  $msg"
      $commitsSincePush++
      $lastHash = Get-StateHash
      $pendingHash = $null
      if ($commitsSincePush -ge $PushEvery) {
        & git -C $Repo push 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { Log "PUSH ok ($commitsSincePush commits)"; $commitsSincePush = 0 }
        else { Log "PUSH failed (will retry) -- local commits are safe" }
      }
    } else {
      Log "COMMIT failed"
      $pendingHash = $null
    }
  }
  else {
    # Idle: flush any unpushed commits so work reaches origin even if you stop typing
    if ($commitsSincePush -gt 0) {
      & git -C $Repo push 2>&1 | Out-Null
      if ($LASTEXITCODE -eq 0) { Log "PUSH ok (idle flush, $commitsSincePush commits)"; $commitsSincePush = 0 }
    }
    $pendingHash = $null
  }
}

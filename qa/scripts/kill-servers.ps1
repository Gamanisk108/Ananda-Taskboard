<#
.SYNOPSIS
  Kill stray Ananda Taskboard dev servers (Django runserver + Vite).

.DESCRIPTION
  Background `manage.py runserver` and `npm run dev` (vite) processes can pile up
  across sessions. A stale one holding :8000 / :5173 makes a fresh server bind a
  different port — or worse, keeps serving OLD code, which silently masks fixes
  during testing. Run this before/after an E2E session to guarantee a clean slate.

.EXAMPLE
  pwsh ./qa/kill-servers.ps1
  pwsh ./qa/kill-servers.ps1 -WhatIf   # list what WOULD be killed, kill nothing
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param()

function Stop-Matching {
    param([string]$Name, [string]$Pattern, [string]$Label)
    $procs = Get-CimInstance Win32_Process -Filter "Name='$Name'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match $Pattern }
    if (-not $procs) { Write-Host "No $Label processes found." ; return 0 }
    foreach ($p in $procs) {
        if ($PSCmdlet.ShouldProcess("PID $($p.ProcessId) [$Label]", "Stop-Process")) {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "Stopped $(@($procs).Count) $Label process(es)."
    return @($procs).Count
}

$killed = 0
$killed += Stop-Matching -Name 'python.exe' -Pattern 'manage\.py\s+runserver' -Label 'Django runserver'
$killed += Stop-Matching -Name 'node.exe'   -Pattern 'vite'                    -Label 'Vite dev'

Start-Sleep -Milliseconds 500
foreach ($port in 8000, 5173) {
    $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    Write-Host ("Port {0}: {1} listener(s) remaining." -f $port, $listeners.Count)
}
Write-Host "Done. Killed $killed process(es) total."

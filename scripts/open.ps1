$ErrorActionPreference = 'Stop'
$platformRoot = Split-Path -Parent $PSScriptRoot
$cfg = Get-Content -LiteralPath (Join-Path $platformRoot 'data\local-config.json') -Raw | ConvertFrom-Json
Start-Process ("http://127.0.0.1:{0}/#{1}" -f $cfg.port,$cfg.token)

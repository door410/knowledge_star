# 安裝知識網 MCP 接頭：讓 Claude 桌面版可以查你的知識網（只讀，私人的不給）
$ErrorActionPreference = 'Stop'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  Write-Host '這台電腦還沒有 Node.js（MCP 接頭需要它）。'
  Write-Host '會幫你打開下載頁：下載 Windows 安裝檔，一直按「下一步」裝好，再雙擊一次這個安裝。'
  Start-Process 'https://nodejs.org/zh-tw/download'
  exit 1
}
$server = Join-Path $PSScriptRoot 'server.js'
$data = $null
foreach ($d in (Get-PSDrive -PSProvider FileSystem)) {
  foreach ($n in @('我的雲端硬碟', 'My Drive')) {
    $p = Join-Path $d.Root (Join-Path $n '知識網資料')
    if (Test-Path -LiteralPath (Join-Path $p '02-知識')) { $data = $p; break }
  }
  if ($data) { break }
}
if (-not $data) {
  Add-Type -AssemblyName System.Windows.Forms
  $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
  $dlg.Description = '請選「知識網資料」資料夾（在 Google 雲端硬碟裡）'
  if ($dlg.ShowDialog() -ne 'OK') { Write-Host '沒有選資料夾，先不安裝。'; exit 1 }
  $data = $dlg.SelectedPath
}
$cfgDir = Join-Path $env:APPDATA 'Claude'
New-Item -ItemType Directory -Force -Path $cfgDir | Out-Null
$cfg = Join-Path $cfgDir 'claude_desktop_config.json'
if (Test-Path -LiteralPath $cfg) {
  Copy-Item -LiteralPath $cfg -Destination ($cfg + '.bak') -Force
  $raw = [IO.File]::ReadAllText($cfg)
  if ($raw.Trim()) { $j = $raw | ConvertFrom-Json } else { $j = New-Object psobject }
} else { $j = New-Object psobject }
if (-not $j.mcpServers) { $j | Add-Member -NotePropertyName mcpServers -NotePropertyValue (New-Object psobject) -Force }
$entry = New-Object psobject -Property @{ command = $node; args = @($server, $data) }
$j.mcpServers | Add-Member -NotePropertyName 'knowledge-net' -NotePropertyValue $entry -Force
[IO.File]::WriteAllText($cfg, ($j | ConvertTo-Json -Depth 20), (New-Object Text.UTF8Encoding $false))
Write-Host ''
Write-Host '完成！知識網資料夾：' $data
Write-Host '請把 Claude 桌面版完全關掉（右下角工作列圖示也要結束）再打開。'
Write-Host '之後可以問 Claude：「查我的知識網，關於 ○○ 我存過什麼？」'

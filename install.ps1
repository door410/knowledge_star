# 知識網安裝：在桌面建立「知識網」捷徑（用 Chrome 開，沒有 Chrome 就用 Edge）
$html = Join-Path $PSScriptRoot '知識網.html'
if (-not (Test-Path -LiteralPath $html)) { Write-Host '找不到 知識網.html，請把整個資料夾一起解壓縮。'; exit 1 }
$browsers = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$browser = $browsers | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop '知識網.lnk'))
if ($browser) { $lnk.TargetPath = $browser; $lnk.Arguments = '"' + $html + '"' } else { $lnk.TargetPath = $html }
$lnk.WorkingDirectory = $PSScriptRoot
$lnk.Save()
Write-Host '完成！桌面已經有「知識網」捷徑。'

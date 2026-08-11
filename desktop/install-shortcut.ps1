param(
  [Parameter(Mandatory = $true)][string]$ExecutablePath
)

$resolvedExe = (Resolve-Path -LiteralPath $ExecutablePath -ErrorAction Stop).Path
$desktop = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($desktop)) { throw 'Windows Desktop path could not be resolved.' }
$shortcutPath = Join-Path $desktop 'Farm Empire.lnk'
$iconPath = Join-Path (Split-Path -Parent $resolvedExe) 'resources\icon.ico'
if (-not (Test-Path -LiteralPath $iconPath)) { throw "Branded icon resource not found: $iconPath" }
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $resolvedExe
$shortcut.WorkingDirectory = Split-Path -Parent $resolvedExe
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = 'Farm Empire'
$shortcut.Save()
$verify = $shell.CreateShortcut($shortcutPath)
if ((Resolve-Path -LiteralPath $verify.TargetPath).Path -ne $resolvedExe) { throw 'Shortcut target verification failed.' }
if ($verify.IconLocation -ne "$iconPath,0") { throw 'Shortcut icon verification failed.' }
Write-Output "Created $shortcutPath -> $resolvedExe"

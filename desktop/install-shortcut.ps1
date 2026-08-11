param(
  [Parameter(Mandatory = $true)][string]$ExecutablePath,
  [string]$ShortcutName = 'Farm Empire.lnk'
)

$resolvedExe = (Resolve-Path -LiteralPath $ExecutablePath -ErrorAction Stop).Path
$desktop = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($desktop)) { throw 'Windows Desktop path could not be resolved.' }
$shortcutPath = Join-Path $desktop $ShortcutName
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $resolvedExe
$shortcut.WorkingDirectory = Split-Path -Parent $resolvedExe
$shortcut.Description = 'Farm Empire'
$shortcut.Save()
$verify = $shell.CreateShortcut($shortcutPath)
if ((Resolve-Path -LiteralPath $verify.TargetPath).Path -ne $resolvedExe) { throw 'Shortcut target verification failed.' }
Write-Output "Created $shortcutPath -> $resolvedExe"

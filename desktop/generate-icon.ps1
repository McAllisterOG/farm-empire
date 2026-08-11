$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$bitmap = New-Object Drawing.Bitmap 256, 256
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([Drawing.Color]::FromArgb(255, 24, 43, 42))
$graphics.FillRectangle([Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 214, 155, 82)), 32, 151, 192, 64)
$graphics.DrawLine([Drawing.Pen]::new([Drawing.Color]::FromArgb(255, 244, 214, 160), 14), 24, 157, 128, 71)
$graphics.DrawLine([Drawing.Pen]::new([Drawing.Color]::FromArgb(255, 244, 214, 160), 14), 128, 71, 232, 157)
$graphics.FillRectangle([Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 124, 77, 50)), 96, 153, 64, 62)
$graphics.DrawRectangle([Drawing.Pen]::new([Drawing.Color]::FromArgb(255, 244, 214, 160), 8), 96, 153, 64, 62)
$graphics.DrawLine([Drawing.Pen]::new([Drawing.Color]::FromArgb(255, 61, 41, 37), 8), 70, 181, 94, 181)
$graphics.DrawLine([Drawing.Pen]::new([Drawing.Color]::FromArgb(255, 61, 41, 37), 8), 162, 181, 186, 181)
$graphics.DrawLine([Drawing.Pen]::new([Drawing.Color]::FromArgb(255, 61, 41, 37), 8), 70, 197, 94, 197)
$graphics.DrawLine([Drawing.Pen]::new([Drawing.Color]::FromArgb(255, 61, 41, 37), 8), 162, 197, 186, 197)
$graphics.DrawLine([Drawing.Pen]::new([Drawing.Color]::FromArgb(255, 140, 207, 115), 10), 128, 35, 128, 71)
$graphics.DrawLine([Drawing.Pen]::new([Drawing.Color]::FromArgb(255, 140, 207, 115), 10), 110, 53, 146, 53)
$bitmap.Save((Join-Path $root 'desktop/icon.png'), [Drawing.Imaging.ImageFormat]::Png)
$icon = [Drawing.Icon]::FromHandle($bitmap.GetHicon())
$stream = [IO.File]::Open((Join-Path $root 'desktop/icon.ico'), [IO.FileMode]::Create)
$icon.Save($stream)
$stream.Dispose()
$icon.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

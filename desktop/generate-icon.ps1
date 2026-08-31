$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# Canonical Farm Empire icon geometry. Every checked-in SVG, PNG, and ICO entry is
# derived from these normalized coordinates and the palette below.
$canvas = 256
$palette = @{
  Background = [Drawing.Color]::FromArgb(255, 24, 43, 42)
  Hay = [Drawing.Color]::FromArgb(255, 214, 155, 82)
  Cream = [Drawing.Color]::FromArgb(255, 244, 214, 160)
  Door = [Drawing.Color]::FromArgb(255, 124, 77, 50)
  Detail = [Drawing.Color]::FromArgb(255, 61, 41, 37)
  Sprout = [Drawing.Color]::FromArgb(255, 140, 207, 115)
}
$geometry = @{
  CornerRadius = 48
  Roof = @(32, 151, 128, 72, 224, 151, 224, 215, 32, 215)
  RoofLine = @(24, 157, 128, 71, 232, 157)
  Door = @(96, 153, 64, 62)
  Slats = @(@(70, 181, 94, 181), @(162, 181, 186, 181), @(70, 197, 94, 197), @(162, 197, 186, 197))
  SproutStem = @(128, 35, 128, 71)
  SproutLeaf = @(110, 53, 146, 53)
}
$root = Split-Path -Parent $PSScriptRoot

function Get-IconSvg {
  $g = $geometry
  @"
<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'>
  <rect width='256' height='256' rx='$($g.CornerRadius)' fill='#182b2a'/>
  <path d='M$($g.Roof[0]) $($g.Roof[1]) L$($g.Roof[2]) $($g.Roof[3]) L$($g.Roof[4]) $($g.Roof[5]) V$($g.Roof[7]) H$($g.Roof[8]) Z' fill='#d69b52' stroke='#f4d6a0' stroke-width='8'/>
  <path d='M$($g.RoofLine[0]) $($g.RoofLine[1]) L$($g.RoofLine[2]) $($g.RoofLine[3]) L$($g.RoofLine[4]) $($g.RoofLine[5])' fill='none' stroke='#f4d6a0' stroke-width='14' stroke-linecap='round' stroke-linejoin='round'/>
  <path d='M$($g.Door[0]) $($g.Door[1]) V$($g.Door[3] + $g.Door[1]) H$($g.Door[0] + $g.Door[2]) V$($g.Door[1]) Z' fill='#7c4d32' stroke='#f4d6a0' stroke-width='8'/>
  <path d='M70 181h24m68 0h24M70 197h24m68 0h24' stroke='#3d2925' stroke-width='8' stroke-linecap='round'/>
  <path d='M128 35v36M110 53h36' stroke='#8ccf73' stroke-width='10' stroke-linecap='round'/>
</svg>
"@
}

function New-IconBitmap([int]$size, [bool]$maskable) {
  $bitmap = New-Object Drawing.Bitmap $size, $size
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear($palette.Background)
    $scale = $size / [double]$canvas
    # Maskable icons reserve a 10% background gutter; the identity remains visibly
    # inside browser and launcher mask safe zones without changing its geometry.
    $inset = if ($maskable) { $size * 0.10 } else { 0 }
    $identityScale = if ($maskable) { $scale * 0.80 } else { $scale }
    $graphics.TranslateTransform($inset, $inset)
    $graphics.ScaleTransform($identityScale, $identityScale)
    $g = $geometry
    $rounded = New-Object Drawing.Drawing2D.GraphicsPath
    $diameter = $g.CornerRadius * 2
    $rounded.AddArc(0, 0, $diameter, $diameter, 180, 90)
    $rounded.AddArc($canvas - $diameter, 0, $diameter, $diameter, 270, 90)
    $rounded.AddArc($canvas - $diameter, $canvas - $diameter, $diameter, $diameter, 0, 90)
    $rounded.AddArc(0, $canvas - $diameter, $diameter, $diameter, 90, 90)
    $rounded.CloseFigure()
    $graphics.FillPath([Drawing.SolidBrush]::new($palette.Background), $rounded)
    $rounded.Dispose()
    $roof = New-Object Drawing.Drawing2D.GraphicsPath
    $roof.AddPolygon([Drawing.Point[]]@((New-Object Drawing.Point $g.Roof[0], $g.Roof[1]), (New-Object Drawing.Point $g.Roof[2], $g.Roof[3]), (New-Object Drawing.Point $g.Roof[4], $g.Roof[5]), (New-Object Drawing.Point $g.Roof[6], $g.Roof[7]), (New-Object Drawing.Point $g.Roof[8], $g.Roof[9])))
    $graphics.FillPath([Drawing.SolidBrush]::new($palette.Hay), $roof)
    $graphics.DrawPath([Drawing.Pen]::new($palette.Cream, 8), $roof)
    $roof.Dispose()
    $roofPen = [Drawing.Pen]::new($palette.Cream, 14); $roofPen.StartCap = 'Round'; $roofPen.EndCap = 'Round'; $roofPen.LineJoin = 'Round'
    $graphics.DrawLines($roofPen, [Drawing.Point[]]@((New-Object Drawing.Point $g.RoofLine[0], $g.RoofLine[1]), (New-Object Drawing.Point $g.RoofLine[2], $g.RoofLine[3]), (New-Object Drawing.Point $g.RoofLine[4], $g.RoofLine[5]))); $roofPen.Dispose()
    $graphics.FillRectangle([Drawing.SolidBrush]::new($palette.Door), $g.Door[0], $g.Door[1], $g.Door[2], $g.Door[3])
    $graphics.DrawRectangle([Drawing.Pen]::new($palette.Cream, 8), $g.Door[0], $g.Door[1], $g.Door[2], $g.Door[3])
    $slatPen = [Drawing.Pen]::new($palette.Detail, 8); $slatPen.StartCap = 'Round'; $slatPen.EndCap = 'Round'
    foreach ($slat in $g.Slats) { $graphics.DrawLine($slatPen, $slat[0], $slat[1], $slat[2], $slat[3]) }; $slatPen.Dispose()
    $sproutPen = [Drawing.Pen]::new($palette.Sprout, 10); $sproutPen.StartCap = 'Round'; $sproutPen.EndCap = 'Round'
    $graphics.DrawLine($sproutPen, $g.SproutStem[0], $g.SproutStem[1], $g.SproutStem[2], $g.SproutStem[3]); $graphics.DrawLine($sproutPen, $g.SproutLeaf[0], $g.SproutLeaf[1], $g.SproutLeaf[2], $g.SproutLeaf[3]); $sproutPen.Dispose()
  } finally { $graphics.Dispose() }
  return $bitmap
}

function Save-Png([string]$path, [int]$size, [bool]$maskable) {
  $bitmap = New-IconBitmap $size $maskable
  try { $bitmap.Save($path, [Drawing.Imaging.ImageFormat]::Png) } finally { $bitmap.Dispose() }
}

function Save-Ico([string]$path) {
  $sizes = @(16, 24, 32, 48, 64, 128, 256)
  $payloads = [System.Collections.Generic.List[byte[]]]::new()
  foreach ($size in $sizes) {
    $bitmap = New-IconBitmap $size $false
    try { $stream = New-Object IO.MemoryStream; $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png); $payloads.Add($stream.ToArray()); $stream.Dispose() } finally { $bitmap.Dispose() }
  }
  $stream = [IO.File]::Open($path, [IO.FileMode]::Create, [IO.FileAccess]::Write)
  $writer = New-Object IO.BinaryWriter $stream
  try {
    $writer.Write([UInt16]0); $writer.Write([UInt16]1); $writer.Write([UInt16]$sizes.Count)
    $offset = 6 + (16 * $sizes.Count)
    for ($index = 0; $index -lt $sizes.Count; $index++) {
      $size = $sizes[$index]; $writer.Write([byte]$(if ($size -eq 256) { 0 } else { $size })); $writer.Write([byte]$(if ($size -eq 256) { 0 } else { $size })); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([UInt16]1); $writer.Write([UInt16]32); $writer.Write([UInt32]$payloads[$index].Length); $writer.Write([UInt32]$offset); $offset += $payloads[$index].Length
    }
    foreach ($payload in $payloads) { $writer.Write($payload) }
  } finally { $writer.Dispose(); $stream.Dispose() }
}

[IO.File]::WriteAllText((Join-Path $root 'desktop/icon.svg'), (Get-IconSvg).Trim() + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
Save-Png (Join-Path $root 'desktop/icon.png') 256 $false
Save-Png (Join-Path $root 'public/icon-192.png') 192 $false
Save-Png (Join-Path $root 'public/icon-512.png') 512 $false
Save-Png (Join-Path $root 'public/icon-maskable-192.png') 192 $true
Save-Png (Join-Path $root 'public/icon-maskable-512.png') 512 $true
Copy-Item (Join-Path $root 'public/icon-512.png') (Join-Path $root 'public/farm-empire-icon.png') -Force
Save-Ico (Join-Path $root 'desktop/icon.ico')

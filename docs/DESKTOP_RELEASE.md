# Farm Empire Windows Desktop Release

The Windows desktop build is an Electron shell around the existing Farm Empire web build. It does not add gameplay, economy, or save-schema behavior.

## Build artifacts

Run `npm.cmd run desktop:package` on Windows. `electron-builder` writes ignored artifacts under `release/`:

- `win-unpacked/` - unpacked x64 application for smoke testing.
- `Farm Empire Setup *.exe` - NSIS installer with Desktop and Start Menu shortcuts.
- `Farm Empire Portable *.exe` - portable x64 executable.

`desktop/generate-icon.ps1` is the canonical Farm Empire icon source: it declares the normalized geometry and palette, then deterministically regenerates `desktop/icon.svg`, `desktop/icon.png`, `desktop/icon.ico`, and the web/PWA PNGs. Run it on Windows after intentionally changing the icon:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\desktop\generate-icon.ps1
```

The checked-in ICO has 16, 24, 32, 48, 64, 128, and 256 pixel 32-bit entries. It is copied outside the app archive into `resources/icon.ico`; the BrowserWindow/taskbar and shortcut helper use that exact branded resource. `public/icon-{192,512}.png` are the normal web/PWA assets, while `public/icon-maskable-{192,512}.png` deliberately reserve a safe background gutter. `public/farm-empire-icon.png` remains a generated compatibility alias. The unsigned executable itself is not post-edited by a signing/resource tool in this release environment.

The repository shortcut helper is the supported branded shortcut workflow for `win-unpacked`; the NSIS installer creates its standard shortcuts but does not run that helper or post-edit shortcut resources.

Create or refresh the branded Desktop shortcut after packaging:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\desktop\install-shortcut.ps1 -ExecutablePath (Resolve-Path '.\release\win-unpacked\Farm Empire.exe')
```

The helper resolves the actual Windows Desktop (including OneDrive redirection), writes only `Farm Empire.lnk`, and verifies its executable and icon targets after saving.

## Development and security boundary

`npm.cmd run desktop:dev` is the explicit development path. It starts Vite on strict `127.0.0.1:5173`, waits up to 15 seconds for an HTTP response, and only then starts Electron. Only that script sets `FARM_EMPIRE_DEV=1` and `FARM_EMPIRE_DEV_URL`; packaged mode always loads the bundled `dist/index.html`, even if those variables are present.

The main process uses context isolation, disabled Node integration, Chromium sandboxing, a single-instance lock, hidden menus, denied navigation/popups, and only opens the existing HTTPS GitHub attribution externally. F11 toggles fullscreen; Escape exits fullscreen only while fullscreen is active.

## Saved data

Desktop saves are browser-local storage managed by Chromium under the stable Electron user-data directory `%APPDATA%\Farm Empire`. They are separate from browser-hosted saves and are not imported or synchronized automatically. Removing the app's user data removes desktop saves; use normal Windows backup practices before doing so.

The installer is unsigned in this repository. Windows SmartScreen may show an unsigned-app warning; this is expected until a publisher certificate and signing workflow are introduced.

The accepted local release uses Electron 43.3.0, electron-builder 26.15.3, Vite 8.2.1, and Vitest 4.1.10. At the 2026-08-11 checkpoint, the full npm audit reported zero vulnerabilities.

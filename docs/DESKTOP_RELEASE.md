# Farm Empire Windows Desktop Release

The Windows desktop build is an Electron shell around the existing Farm Empire web build. It does not add gameplay, economy, or save-schema behavior.

## Build artifacts

Run `npm.cmd run desktop:package` on Windows. `electron-builder` writes ignored artifacts under `release/`:

- `win-unpacked/` - unpacked x64 application for smoke testing.
- `Farm Empire Setup *.exe` - NSIS installer with Desktop and Start Menu shortcuts.
- `Farm Empire Portable *.exe` - portable x64 executable.

The checked-in `desktop/icon.svg` is the original deterministic icon source, with checked-in PNG/ICO derivatives for Windows. The ICO is copied outside the app archive into `resources/icon.ico`; the BrowserWindow/taskbar and shortcut helper use that exact branded resource. The unsigned executable itself is not post-edited by a signing/resource tool in this release environment.

The repository shortcut helper is the supported branded shortcut workflow for `win-unpacked`; the NSIS installer creates its standard shortcuts but does not run that helper or post-edit shortcut resources.

## Development and security boundary

`npm.cmd run desktop:dev` is the explicit development path. It starts Vite on strict `127.0.0.1:5173`, waits up to 15 seconds for an HTTP response, and only then starts Electron. Only that script sets `FARM_EMPIRE_DEV=1` and `FARM_EMPIRE_DEV_URL`; packaged mode always loads the bundled `dist/index.html`, even if those variables are present.

The main process uses context isolation, disabled Node integration, Chromium sandboxing, a single-instance lock, hidden menus, denied navigation/popups, and only opens the existing HTTPS GitHub attribution externally. F11 toggles fullscreen; Escape exits fullscreen only while fullscreen is active.

## Saved data

Desktop saves are browser-local storage managed by Chromium under the stable Electron user-data directory `%APPDATA%\Farm Empire`. They are separate from browser-hosted saves and are not imported or synchronized automatically. Removing the app's user data removes desktop saves; use normal Windows backup practices before doing so.

The installer is unsigned in this repository. Windows SmartScreen may show an unsigned-app warning; this is expected until a publisher certificate and signing workflow are introduced.

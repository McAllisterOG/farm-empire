import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isDevUrlEnabled } from '../desktop/policy.mjs';
import { isFarmEmpireHtml } from '../desktop/devPolicy.mjs';

const policy = readFileSync(resolve('desktop/policy.mjs'), 'utf8');
const main = readFileSync(resolve('desktop/main.mjs'), 'utf8');
const dev = readFileSync(resolve('desktop/dev.mjs'), 'utf8');
const shortcut = readFileSync(resolve('desktop/install-shortcut.ps1'), 'utf8');

describe('Windows desktop release boundary', () => {
  it('declares the required Electron isolation and packaged loading policy', () => {
    expect(main).toContain('contextIsolation: true');
    expect(main).toContain('nodeIntegration: false');
    expect(main).toContain('sandbox: true');
    expect(main).toContain("loadFile(join(__dirname, '..', 'dist', 'index.html'))");
    expect(main).toContain("app.requestSingleInstanceLock()");
    expect(main).toContain("mainWindow.setFullScreen");
    expect(main).not.toContain('preload:');
  });

  it('restricts external navigation to the existing HTTPS attribution', () => {
    expect(policy).toContain("https://github.com/McAllisterOG/farm-empire");
    expect(main).toContain('isAllowedExternalUrl');
    expect(main).toContain("return { action: 'deny' }");
  });

  it('only permits the development URL before packaging', () => {
    expect(isDevUrlEnabled({ isPackaged: false, devFlag: '1', devUrl: 'http://127.0.0.1:5173/' })).toBe(true);
    expect(isDevUrlEnabled({ isPackaged: true, devFlag: '1', devUrl: 'http://127.0.0.1:5173/' })).toBe(false);
    expect(isDevUrlEnabled({ isPackaged: false, devFlag: '0', devUrl: 'http://127.0.0.1:5173/' })).toBe(false);
  });

  it('uses a strict fixed Vite port and waits for HTTP readiness before Electron', () => {
    expect(dev).toContain("'--strictPort'");
    expect(dev).toContain("const port = 5173;");
    expect(dev).toContain('assertPortFree()');
    expect(dev).toContain('waitForFarmEmpire(devUrl, vite)');
    expect(dev).toContain('shell: false');
    expect(dev).not.toContain('shell: true');
    expect(dev).toContain('taskkill.exe');
    expect(dev.indexOf('await waitForFarmEmpire(devUrl, vite)')).toBeLessThan(dev.indexOf('spawn(electronCommand'));
    expect(isFarmEmpireHtml('<!doctype html><title>Farm Empire</title><canvas id="game-canvas"></canvas>')).toBe(true);
    expect(isFarmEmpireHtml('<!doctype html><title>Other App</title><canvas id="game-canvas"></canvas>')).toBe(false);
  });

  it('resolves only the real Desktop and verifies the exact shortcut target', () => {
    expect(shortcut).toContain("[Environment]::GetFolderPath('Desktop')");
    expect(shortcut).toContain("Join-Path $desktop 'Farm Empire.lnk'");
    expect(shortcut).not.toContain('$ShortcutName');
    expect(shortcut).toContain('resources\\icon.ico');
    expect(shortcut).toContain('IconLocation');
    expect(shortcut).toContain('Shortcut target verification failed');
  });
});

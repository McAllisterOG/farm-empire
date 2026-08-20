import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isDevUrlEnabled, resolveUserDataPath } from '../desktop/policy.mjs';
import { isFarmEmpireHtml } from '../desktop/devPolicy.mjs';
import { createRecoveryGate } from '../desktop/recoveryGate.mjs';

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

  it('keeps failure diagnostics bounded and offers desktop recovery without relaxing policy', () => {
    expect(main).toContain("'did-fail-load'");
    expect(main).toContain("'render-process-gone'");
    expect(main).toContain("'unresponsive'");
    expect(main).toContain("'console-message'");
    expect(main).toContain("buttons: ['Reload', 'Close']");
    expect(main).toContain('if (level >= 2)');
    expect(main).toContain('createRecoveryGate');
  });

  it('suppresses only concurrent recovery prompts and releases for later independent failures', () => {
    const gate = createRecoveryGate();
    expect(gate.tryOpen()).toBe(true);
    expect(gate.tryOpen()).toBe(false);
    expect(gate.isOpen()).toBe(true);
    gate.release();
    expect(gate.isOpen()).toBe(false);
    expect(gate.tryOpen()).toBe(true);
  });

  it('uses an explicit, absolute QA profile only when the full opt-in pair is supplied', () => {
    const appDataPath = resolve('test-app-data');
    const qaUserDataPath = resolve('test-qa-user-data');
    const defaultPath = join(appDataPath, 'Farm Empire');

    expect(resolveUserDataPath({ appDataPath })).toBe(defaultPath);
    expect(resolveUserDataPath({ appDataPath, qaFlag: '1' })).toBe(defaultPath);
    expect(resolveUserDataPath({ appDataPath, qaUserDataPath })).toBe(defaultPath);
    expect(resolveUserDataPath({ appDataPath, qaFlag: '1', qaUserDataPath: 'test-qa-user-data' })).toBe(defaultPath);
    expect(resolveUserDataPath({ appDataPath, qaFlag: '1', qaUserDataPath: `${qaUserDataPath}\0` })).toBe(defaultPath);
    expect(resolveUserDataPath({ appDataPath, qaFlag: '1', qaUserDataPath })).toBe(qaUserDataPath);
  });

  it('keeps the user-data profile decision ahead of the single-instance lock', () => {
    expect(main).toContain('resolveUserDataPath');
    expect(main.indexOf("app.setPath('userData'")).toBeLessThan(main.indexOf('app.requestSingleInstanceLock()'));
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

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const policy = readFileSync(resolve('desktop/policy.mjs'), 'utf8');
const main = readFileSync(resolve('desktop/main.mjs'), 'utf8');
const shortcut = readFileSync(resolve('desktop/install-shortcut.ps1'), 'utf8');

describe('Windows desktop release boundary', () => {
  it('declares the required Electron isolation and packaged loading policy', () => {
    expect(main).toContain('contextIsolation: true');
    expect(main).toContain('nodeIntegration: false');
    expect(main).toContain('sandbox: true');
    expect(main).toContain("loadFile(join(__dirname, '..', 'dist', 'index.html'))");
    expect(main).toContain("app.requestSingleInstanceLock()");
    expect(main).toContain("mainWindow.setFullScreen");
  });

  it('restricts external navigation to the existing HTTPS attribution', () => {
    expect(policy).toContain("https://github.com/McAllisterOG/farm-empire");
    expect(main).toContain('isAllowedExternalUrl');
    expect(main).toContain("return { action: 'deny' }");
  });

  it('resolves only the real Desktop and verifies the exact shortcut target', () => {
    expect(shortcut).toContain("[Environment]::GetFolderPath('Desktop')");
    expect(shortcut).toContain("Farm Empire.lnk");
    expect(shortcut).toContain('Shortcut target verification failed');
  });
});

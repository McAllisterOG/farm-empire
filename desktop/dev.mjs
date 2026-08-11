import { request } from 'node:http';
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const electronCommand = process.platform === 'win32' ? 'electron.cmd' : 'electron';
const devUrl = 'http://127.0.0.1:5173/';
const vite = spawn(npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
let electron;
let shuttingDown = false;

function stop(child) {
  if (child && !child.killed) child.kill();
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  stop(electron);
  stop(vite);
  process.exit(code);
}

function waitForHttpReady(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Vite did not become ready within ${timeoutMs}ms.`));
        return;
      }
      const req = request(url, { timeout: 1000 }, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) resolve();
        else setTimeout(probe, 100);
      });
      req.on('error', () => setTimeout(probe, 100));
      req.on('timeout', () => req.destroy());
      req.end();
    };
    probe();
  });
}

vite.once('error', () => shutdown(1));
vite.once('exit', (code) => { if (!shuttingDown && code !== 0) shutdown(code ?? 1); });

try {
  await waitForHttpReady(devUrl);
  electron = spawn(electronCommand, ['desktop/main.mjs'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, FARM_EMPIRE_DEV: '1', FARM_EMPIRE_DEV_URL: devUrl },
  });
  electron.once('error', () => shutdown(1));
  electron.once('exit', (code) => shutdown(code ?? 0));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
}

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));

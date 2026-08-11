import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { isFarmEmpireHtml } from './devPolicy.mjs';

const require = createRequire(import.meta.url);
const viteEntry = join(dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
const electronCommand = require('electron');
const devUrl = 'http://127.0.0.1:5173/';
const host = '127.0.0.1';
const port = 5173;
let vite;
let electron;
let shuttingDown = false;

function waitForExit(child, timeoutMs = 3000) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

async function terminate(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', shell: false });
    await new Promise((resolve) => killer.once('exit', resolve));
  } else {
    child.kill('SIGTERM');
  }
  await waitForExit(child);
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.all([terminate(electron), terminate(vite)]);
  process.exit(code);
}

function assertPortFree() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(new Error(`Development port ${host}:${port} is already in use.`)));
    probe.listen(port, host, () => probe.close(resolve));
  });
}

function waitForFarmEmpire(url, child, timeoutMs = 15000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const failIfExited = (code) => reject(new Error(`Vite exited before readiness (code ${code ?? 'unknown'}).`));
    child.once('error', () => reject(new Error('Vite failed to start.')));
    child.once('exit', failIfExited);
    const probe = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Farm Empire Vite did not become ready within ${timeoutMs}ms.`));
        return;
      }
      const req = request(url, { timeout: 1000 }, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          if (response.statusCode === 200 && isFarmEmpireHtml(body)) resolve();
          else setTimeout(probe, 100);
        });
      });
      req.on('error', () => setTimeout(probe, 100));
      req.on('timeout', () => req.destroy());
      req.end();
    };
    probe();
  });
}

process.once('SIGINT', () => { void shutdown(0); });
process.once('SIGTERM', () => { void shutdown(0); });

try {
  await assertPortFree();
  vite = spawn(process.execPath, [viteEntry, '--host', host, '--port', String(port), '--strictPort'], {
    stdio: 'inherit',
    shell: false,
  });
  vite.once('exit', (code) => { if (!shuttingDown) void shutdown(code === 0 ? 1 : code ?? 1); });
  await waitForFarmEmpire(devUrl, vite);
  electron = spawn(electronCommand, ['desktop/main.mjs'], {
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, FARM_EMPIRE_DEV: '1', FARM_EMPIRE_DEV_URL: devUrl },
  });
  electron.once('error', () => { void shutdown(1); });
  electron.once('exit', (code) => { if (!shuttingDown) void shutdown(code ?? 0); });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  await shutdown(1);
}

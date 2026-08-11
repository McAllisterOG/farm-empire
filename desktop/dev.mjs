import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const vite = spawn(npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
const electron = spawn(process.platform === 'win32' ? 'electron.cmd' : 'electron', ['desktop/main.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, FARM_EMPIRE_DEV: '1', FARM_EMPIRE_DEV_URL: 'http://127.0.0.1:5173/' },
});
const stop = () => { if (!vite.killed) vite.kill(); if (!electron.killed) electron.kill(); };
electron.on('exit', (code) => { stop(); process.exit(code ?? 0); });
process.on('SIGINT', () => { stop(); process.exit(0); });

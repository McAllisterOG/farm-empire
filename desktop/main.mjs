import { app, BrowserWindow, Menu, shell, dialog } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_ID, GITHUB_ATTRIBUTION_URL, isAllowedExternalUrl, isDevUrlEnabled, resolveUserDataPath } from './policy.mjs';
import { createRecoveryGate } from './recoveryGate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isExplicitDev = isDevUrlEnabled({
  isPackaged: app.isPackaged,
  devFlag: process.env.FARM_EMPIRE_DEV,
  devUrl: process.env.FARM_EMPIRE_DEV_URL,
});
const iconPath = app.isPackaged ? join(process.resourcesPath, 'icon.ico') : join(__dirname, 'icon.ico');

app.setAppUserModelId(APP_ID);
app.setName('Farm Empire');
app.setPath('userData', resolveUserDataPath({
  appDataPath: app.getPath('appData'),
  qaFlag: process.env.FARM_EMPIRE_QA,
  qaUserDataPath: process.env.FARM_EMPIRE_QA_USER_DATA,
}));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let mainWindow;

  const focusMainWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  };

  app.on('second-instance', focusMainWindow);

  function createWindow() {
    Menu.setApplicationMenu(null);
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1024,
      minHeight: 640,
      resizable: true,
      show: false,
      title: 'Farm Empire',
      icon: iconPath,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    mainWindow.once('ready-to-show', () => mainWindow.show());
    const recoveryGate = createRecoveryGate();
    const showRecovery = async (reason) => {
      if (!recoveryGate.tryOpen()) return;
      console.error(`[Farm Empire] desktop recovery: ${reason}`);
      if (!mainWindow || mainWindow.isDestroyed()) { recoveryGate.release(); return; }
      let response = 1;
      try {
        ({ response } = await dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: 'Farm Empire needs to recover',
          message: 'Farm Empire encountered a desktop runtime problem. Your last saved farm is safe.',
          detail: 'You can reload the game or close it and restart.',
          buttons: ['Reload', 'Close'],
          defaultId: 0,
          cancelId: 1,
          noLink: true,
        }));
      } catch (error) {
        console.error('[Farm Empire] recovery dialog failed', error);
      } finally {
        recoveryGate.release();
      }
      if (response === 0 && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
      else if (!mainWindow.isDestroyed()) mainWindow.close();
    };
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame) void showRecovery(`load failed (${errorCode}): ${errorDescription} at ${validatedURL}`);
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      void showRecovery(`renderer process gone: ${details.reason}`);
    });
    mainWindow.on('unresponsive', () => { void showRecovery('window unresponsive'); });
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      if (level >= 2) console.error(`[Farm Empire renderer] ${sourceId}:${line} ${message}`);
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedExternalUrl(url)) void shell.openExternal(GITHUB_ATTRIBUTION_URL);
      return { action: 'deny' };
    });
    mainWindow.webContents.on('will-navigate', (event, url) => {
      event.preventDefault();
      if (isAllowedExternalUrl(url)) void shell.openExternal(GITHUB_ATTRIBUTION_URL);
    });
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'F11') {
        event.preventDefault();
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      } else if (input.key === 'Escape' && mainWindow.isFullScreen()) {
        event.preventDefault();
        mainWindow.setFullScreen(false);
      }
    });

    if (isExplicitDev) {
      void mainWindow.loadURL(process.env.FARM_EMPIRE_DEV_URL);
    } else {
      void mainWindow.loadFile(join(__dirname, '..', 'dist', 'index.html'));
    }
  }

  app.whenReady().then(createWindow);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else focusMainWindow();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

import { app, BrowserWindow, Menu, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_ID, GITHUB_ATTRIBUTION_URL, isAllowedExternalUrl, isDevUrlEnabled } from './policy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isExplicitDev = isDevUrlEnabled({
  isPackaged: app.isPackaged,
  devFlag: process.env.FARM_EMPIRE_DEV,
  devUrl: process.env.FARM_EMPIRE_DEV_URL,
});
const iconPath = app.isPackaged ? join(process.resourcesPath, 'icon.ico') : join(__dirname, 'icon.ico');

app.setAppUserModelId(APP_ID);
app.setName('Farm Empire');
app.setPath('userData', join(app.getPath('appData'), 'Farm Empire'));

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

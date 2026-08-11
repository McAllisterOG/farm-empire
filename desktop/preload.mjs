import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('farmEmpireDesktop', Object.freeze({
  appName: 'Farm Empire',
  packaged: !process.env.FARM_EMPIRE_DEV,
}));

import { isAbsolute, join, resolve } from 'node:path';

export const APP_ID = 'com.farmempire.desktop';
export const GITHUB_ATTRIBUTION_URL = 'https://github.com/McAllisterOG/farm-empire';

export function resolveUserDataPath({ appDataPath, qaFlag, qaUserDataPath }) {
  const defaultPath = join(appDataPath, 'Farm Empire');
  const isValidQaPath = typeof qaUserDataPath === 'string'
    && qaUserDataPath.length > 0
    && !qaUserDataPath.includes('\0')
    && isAbsolute(qaUserDataPath);

  return qaFlag === '1' && isValidQaPath ? resolve(qaUserDataPath) : defaultPath;
}

export function isDevUrlEnabled({ isPackaged, devFlag, devUrl }) {
  return !isPackaged && devFlag === '1' && typeof devUrl === 'string' && devUrl.length > 0;
}

export function isAllowedExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.href === `${GITHUB_ATTRIBUTION_URL}/`;
  } catch {
    return false;
  }
}

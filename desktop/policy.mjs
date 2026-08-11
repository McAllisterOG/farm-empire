export const APP_ID = 'com.farmempire.desktop';
export const GITHUB_ATTRIBUTION_URL = 'https://github.com/McAllisterOG/farm-empire';

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

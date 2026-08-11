export declare const APP_ID: string;
export declare const GITHUB_ATTRIBUTION_URL: string;
export declare function isDevUrlEnabled(args: {
  isPackaged: boolean;
  devFlag: string | undefined;
  devUrl: string | undefined;
}): boolean;
export declare function isAllowedExternalUrl(value: string): boolean;

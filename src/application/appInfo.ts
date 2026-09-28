export interface AppInfo {
  name: string;
  version: string;
  platform: 'desktop';
}

export type AppInfoResult =
  | { status: 'ready'; info: AppInfo }
  | { status: 'unavailable'; reason: string };

export interface AppInfoPort {
  getAppInfo(): Promise<AppInfoResult>;
}

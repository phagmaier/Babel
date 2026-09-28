import { invoke } from '@tauri-apps/api/core';
import type { AppInfoPort, AppInfoResult } from '../application/appInfo';

export const nativeAppInfo: AppInfoPort = {
  async getAppInfo(): Promise<AppInfoResult> {
    try {
      const info = await invoke<{
        name: string;
        version: string;
        platform: 'desktop';
      }>('app_info');
      return { status: 'ready', info };
    } catch {
      return {
        status: 'unavailable',
        reason: 'Native app information could not be read.',
      };
    }
  },
};

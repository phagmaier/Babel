import type { AppInfoPort } from '../application/appInfo';

/** Browser preview has no native IPC. It never claims desktop readiness. */
export const browserAppInfo: AppInfoPort = {
  async getAppInfo() {
    return {
      status: 'unavailable' as const,
      reason: 'Browser preview only; native services are unavailable.',
    };
  },
};

import { invoke } from '@tauri-apps/api/core';
import type { RecoveryPort } from '../application/startupRecovery';

export const nativeRecovery: RecoveryPort = {
  list: () => invoke('list_local_recovery', { request: {} }),
  preview: (selection) => invoke('read_local_recovery', { request: selection }),
};

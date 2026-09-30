import { invoke } from '@tauri-apps/api/core';
import type { RecoveryPort } from '../application/startupRecovery';

export const nativeRecovery: RecoveryPort = {
  inspect: (identity) =>
    invoke('list_document_recovery', { request: identity }),
  previewSelected: (request) => invoke('read_document_recovery', { request }),
  resume: (selection) =>
    invoke('resume_local_recovery', { request: selection }),
  list: () => invoke('list_local_recovery', { request: {} }),
  preview: (selection) => invoke('read_local_recovery', { request: selection }),
};

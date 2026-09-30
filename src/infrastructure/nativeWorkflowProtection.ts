import { invoke } from '@tauri-apps/api/core';
import type { WorkflowProtectionPort } from '../application/workflowProtection';
export const nativeWorkflowProtection: WorkflowProtectionPort = {
  protect(request) {
    return invoke('protect_workflow', { request });
  },
};

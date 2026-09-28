import { invoke } from '@tauri-apps/api/core';
import type {
  CopyRequest,
  KeepRequest,
  RecoverRequest,
  RecoveryChoicesPort,
} from '../application/recoveryChoices';
import type { DocumentIdentity } from '../application/documents';
import type { RecoverySelection } from '../application/startupRecovery';

export const nativeRecoveryChoices: RecoveryChoicesPort = {
  compare: (request: {
    identity: DocumentIdentity;
    selection: RecoverySelection;
  }) => invoke('compare_recovery', { request }),
  recover: (request: RecoverRequest) =>
    invoke('recover_checkpoint_as_current', { request }),
  keep: (request: KeepRequest) => invoke('keep_current_source', { request }),
  copy: (request: CopyRequest) => invoke('save_recovered_copy', { request }),
  resolve: (identity: DocumentIdentity) =>
    invoke('resolve_save_transaction', { request: { identity } }),
};

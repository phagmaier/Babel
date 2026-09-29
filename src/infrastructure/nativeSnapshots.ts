import { invoke } from '@tauri-apps/api/core';
import type { SnapshotPort } from '../application/snapshots';
export const nativeSnapshots: SnapshotPort = {
  list: (request) => invoke('list_snapshots', { request }),
  read: (request) => invoke('read_snapshot', { request }),
  create: (request) => invoke('create_snapshot', { request }),
  prune: (request) => invoke('prune_snapshots', { request }),
  restore: (request) => invoke('restore_snapshot', { request }),
  copy: (request) => invoke('save_external_copy', { request }),
};

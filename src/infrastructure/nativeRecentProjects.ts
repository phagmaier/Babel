import { invoke } from '@tauri-apps/api/core';
import type { RecentProjectsPort } from '../application/recentProjects';

export const nativeRecentProjects: RecentProjectsPort = {
  list: () => invoke('list_recent_projects', { request: {} }),
  remove: (entryId) =>
    invoke('remove_recent_project', { request: { entryId } }),
  open: (entryId) => invoke('open_recent_project', { request: { entryId } }),
  locate: (entryId) =>
    invoke('locate_recent_project', { request: { entryId } }),
  confirmLocation: (selection, choice) =>
    invoke('confirm_recent_location', {
      request: {
        entryId: selection.entryId,
        selectionToken: selection.selectionToken,
        choice,
      },
    }),
};

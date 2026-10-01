import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface MenuState {
  token: string;
  commands: { id: string; binding: string | null; enabled: boolean }[];
}
export interface MenuAction {
  token: string;
  id: string;
}
// Across route changes, retire/activate updates remain serial. A stale response
// never enables a retired UI callback; the native event also carries its token.
let publication = Promise.resolve();
export const nativeCommands = {
  publish(state: MenuState): Promise<void> {
    const next = publication.then(() =>
      invoke<void>('update_command_menu', { request: state }),
    );
    publication = next.catch(() => {});
    return next;
  },
  async listen(action: (event: MenuAction) => void) {
    return listen<MenuAction>('application-command', (event) =>
      action(event.payload),
    );
  },
};

/** Home reads metadata only. A staged locate never opens a registration. */
import type {
  LocateSelection,
  RecentList,
  RecentProjectsPort,
} from './recentProjects';

export interface RecentState {
  catalog: RecentList | null;
  loading: boolean;
  busy: boolean;
  message: string;
  selection: LocateSelection | null;
}

export class RecentController {
  private live = true;
  private sequence = 0;
  state: RecentState = {
    catalog: null,
    loading: true,
    busy: false,
    message: '',
    selection: null,
  };
  constructor(
    private readonly port: RecentProjectsPort,
    private readonly changed: (state: RecentState) => void,
  ) {}
  private update(patch: Partial<RecentState>) {
    if (!this.live) return;
    this.state = { ...this.state, ...patch };
    this.changed(this.state);
  }
  async refresh() {
    if (!this.live || this.state.busy) return;
    const sequence = ++this.sequence;
    this.update({ loading: true, selection: null, message: '' });
    try {
      const catalog = await this.port.list();
      if (sequence === this.sequence) this.update({ catalog, loading: false });
    } catch {
      if (sequence === this.sequence)
        this.update({
          loading: false,
          message:
            'Recents could not be read. You can still create or open a screenplay.',
        });
    }
  }
  async locate(entryId: string) {
    if (!this.live || this.state.busy || this.state.loading) return;
    const sequence = ++this.sequence;
    this.update({
      busy: true,
      selection: null,
      message: 'Choose the file in the native dialog.',
    });
    try {
      const selection = await this.port.locate(entryId);
      if (sequence !== this.sequence) return;
      if (selection && selection.entryId !== entryId)
        throw new Error('Mismatched selection');
      this.update({
        selection,
        message: selection
          ? ''
          : 'Locate cancelled. The recent entry and recovery are unchanged.',
      });
    } catch {
      if (sequence === this.sequence)
        this.update({
          message:
            'The file could not be selected safely. The recent entry and recovery are unchanged.',
        });
    } finally {
      if (sequence === this.sequence) this.update({ busy: false });
    }
  }
  cancelLocation() {
    this.update({
      selection: null,
      message:
        'Linking cancelled. The recent entry and recovery are unchanged.',
    });
  }
  async remove(entryId: string) {
    if (!this.live || this.state.busy || this.state.loading) return;
    const sequence = ++this.sequence;
    this.update({ busy: true, selection: null, message: '' });
    try {
      await this.port.remove(entryId);
      if (sequence !== this.sequence) return;
      this.update({
        catalog: this.state.catalog
          ? {
              ...this.state.catalog,
              entries: this.state.catalog.entries.filter(
                (e) => e.entryId !== entryId,
              ),
            }
          : null,
        message:
          'Removed from Recents. The screenplay and recovery files were not deleted.',
      });
    } catch {
      if (sequence === this.sequence)
        this.update({
          message:
            'Removal could not be confirmed. The screenplay and recovery files were not deleted.',
        });
    } finally {
      if (sequence === this.sequence) this.update({ busy: false });
    }
  }
  dispose() {
    this.live = false;
    ++this.sequence;
  }
}

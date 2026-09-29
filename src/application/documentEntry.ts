/** M3-09 native document entry. All selection happens natively; no IPC carries a path. */
import type { DocumentIdentity, OpenDocument } from './documents';
import type { CopyDestination } from './snapshots';

export interface DocumentEntryPort {
  /** Allocates an immediate recoverable unsaved identity with empty source. */
  createUnsaved(): Promise<OpenDocument>;
  /** Native file picker. Null means the user cancelled; state is preserved. */
  openViaPicker(): Promise<OpenDocument | null>;
  /** Native folder picker bound to one registration/session. Null is cancel. */
  selectDestination(
    identity: DocumentIdentity,
  ): Promise<CopyDestination | null>;
}

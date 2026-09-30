import type { OpenDocument } from './documents';

export type RecentHealth = 'ready' | 'needsAttention';
export interface RecentEntry {
  entryId: string;
  documentId: string;
  kind: 'managed' | 'loose';
  /** Bounded filename derivative; canonical author titles remain in Fountain. */
  fileName: string;
  lastKnownModifiedSeconds: number;
  lastKnownModifiedNanos: number;
  availability: 'available' | 'missing' | 'unknown';
}
export interface RecentList {
  entries: readonly RecentEntry[];
  health: RecentHealth;
}
export interface LocateSelection {
  entryId: string;
  selectionToken: string;
  fileName: string;
  sameManagedIdentity: boolean;
  /** Comparison only: equal bytes do not establish identity. */
  contentMatchesLastKnown: boolean;
  canLinkMoved: boolean;
}
export interface RecentOpen {
  document: OpenDocument;
  registryHealth: RecentHealth;
}
export type LocateChoice = 'linkMoved' | 'openDifferent';
export interface RecentProjectsPort {
  list(): Promise<RecentList>;
  remove(entryId: string): Promise<void>;
  open(entryId: string): Promise<RecentOpen>;
  /** Native picker; cancellation preserves all prior state. */
  locate(entryId: string): Promise<LocateSelection | null>;
  /** Explicit choice after inspecting the selected file's comparison facts. */
  confirmLocation(
    selection: LocateSelection,
    choice: LocateChoice,
  ): Promise<RecentOpen>;
}

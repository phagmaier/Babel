/** Best-effort local UI hints. Never a protection receipt or manuscript mirror. */
export const positionStorageKey = 'babel.positions.v1';
export const MAX_POSITION_ENTRIES = 64;
export const MAX_POSITION_BYTES = 48_000;
export interface PositionAnchor {
  readonly row: number;
  readonly offset: number;
}
export interface RecentPosition {
  readonly documentId: string;
  readonly sourceSha256: string;
  readonly anchor: PositionAnchor;
  readonly head: PositionAnchor;
  readonly viewport: { readonly row: number; readonly fraction: number } | null;
}
interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const exact = (
  value: unknown,
  keys: string,
): value is Record<string, unknown> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === keys;
const integer = (value: unknown, max: number) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= max;
function anchor(value: unknown): value is PositionAnchor {
  return (
    exact(value, 'offset,row') &&
    integer(value.row, 49_999) &&
    integer(value.offset, 20 * 1024 * 1024)
  );
}
function valid(value: unknown): value is RecentPosition {
  return (
    exact(value, 'anchor,documentId,head,sourceSha256,viewport') &&
    typeof value.documentId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      value.documentId,
    ) &&
    !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value.documentId) &&
    typeof value.sourceSha256 === 'string' &&
    /^[0-9a-f]{64}$/.test(value.sourceSha256) &&
    anchor(value.anchor) &&
    anchor(value.head) &&
    (value.viewport === null ||
      (exact(value.viewport, 'fraction,row') &&
        integer(value.viewport.row, 49_999) &&
        typeof value.viewport.fraction === 'number' &&
        Number.isFinite(value.viewport.fraction) &&
        value.viewport.fraction >= 0 &&
        value.viewport.fraction <= 1))
  );
}
export class RecentPositions {
  error = '';
  constructor(private readonly storage?: StoragePort) {}
  private read(): RecentPosition[] {
    if (!this.storage) throw new Error('Unavailable storage');
    const raw = this.storage.getItem(positionStorageKey);
    if (raw === null) return [];
    if (raw.length > MAX_POSITION_BYTES) throw new Error('Oversize hints');
    const data: unknown = JSON.parse(raw);
    if (
      !exact(data, 'positions,version') ||
      data.version !== 1 ||
      !Array.isArray(data.positions) ||
      data.positions.length > MAX_POSITION_ENTRIES ||
      !data.positions.every(valid) ||
      new Set(data.positions.map((p) => p.documentId)).size !==
        data.positions.length
    )
      throw new Error('Invalid hints');
    return data.positions;
  }
  find(documentId: string, sourceSha256: string): RecentPosition | null {
    try {
      const positions = this.read();
      this.error = '';
      return (
        positions.find(
          (p) => p.documentId === documentId && p.sourceSha256 === sourceSha256,
        ) ?? null
      );
    } catch {
      this.error =
        'Recent positions could not be read. Stored hints are retained; writing, saving and recovery remain available.';
      return null;
    }
  }
  remember(position: RecentPosition): boolean {
    try {
      if (!valid(position)) throw new Error('Invalid hint');
      const positions = [
        position,
        ...this.read().filter((p) => p.documentId !== position.documentId),
      ].slice(0, MAX_POSITION_ENTRIES);
      const raw = JSON.stringify({ version: 1, positions });
      if (raw.length > MAX_POSITION_BYTES) throw new Error('Oversize hints');
      this.storage!.setItem(positionStorageKey, raw);
      this.error = '';
      return true;
    } catch {
      this.error =
        'Recent position could not be stored. Writing, saving and close remain available; no protection comes from this hint.';
      return false;
    }
  }
}
export function localRecentPositions(): RecentPositions {
  try {
    return new RecentPositions(window.localStorage);
  } catch {
    return new RecentPositions();
  }
}

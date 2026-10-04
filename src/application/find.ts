import { sameStamp } from './manuscriptProjection';
import {
  defaultFindOptions,
  findSlices,
  sceneRange,
  type FindMatch,
  type FindOptions,
} from '../domain/find';
import type {
  ManuscriptProjection,
  ManuscriptStamp,
  ProjectionState,
} from './manuscriptProjection';
export interface FindState {
  readonly enabled: boolean;
  readonly options: FindOptions;
  readonly phase: 'idle' | 'pending' | 'current' | 'unavailable';
  readonly projection: ManuscriptProjection | null;
  readonly matches: readonly FindMatch[];
  readonly active: number;
  readonly message: string;
}
/** One cancellable job and one immutable result cache. No source capture or native calls. */
export class FindController {
  state: FindState = {
    enabled: false,
    options: defaultFindOptions,
    phase: 'idle',
    projection: null,
    matches: [],
    active: -1,
    message: 'Enter text to find.',
  };
  private live = true;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sequence = 0;
  private source: ProjectionState | null = null;
  private row = -1;
  private cache: {
    index: ManuscriptProjection['index'];
    key: string;
    matches: readonly FindMatch[];
  } | null = null;
  constructor(
    private readonly stamp: () => ManuscriptStamp | null,
    private readonly changed: (state: FindState) => void,
  ) {}
  private publish(patch: Partial<FindState>) {
    if (!this.live) return;
    this.state = Object.freeze({ ...this.state, ...patch });
    this.changed(this.state);
  }
  isCurrent(projection = this.state.projection): boolean {
    const stamp = this.stamp();
    return this.live && !!projection && !!stamp && sameStamp(stamp, projection);
  }
  private cancel() {
    this.sequence++;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  setProjection(source: ProjectionState, row: number) {
    this.source = source;
    this.row = row;
    this.search();
  }
  configure(
    options: FindOptions = this.state.options,
    enabled = this.state.enabled,
  ) {
    this.publish({
      options: Object.freeze({ ...options }),
      enabled,
      active: -1,
      message: '',
    });
    this.search();
  }
  private search() {
    this.cancel();
    if (!this.state.enabled || !this.state.options.query) {
      this.publish({
        phase: 'idle',
        matches: [],
        projection: null,
        message: 'Enter text to find.',
      });
      return;
    }
    const projection = this.source?.projection;
    if (
      this.source?.phase !== 'current' ||
      !projection ||
      !this.isCurrent(projection)
    ) {
      this.publish({
        phase: this.source?.phase === 'unavailable' ? 'unavailable' : 'pending',
        projection: null,
        matches: [],
        message:
          'Find is waiting for current captured text. Earlier results cannot navigate.',
      });
      return;
    }
    const options = this.state.options;
    const key = JSON.stringify([
      options,
      options.scope === 'scene'
        ? sceneRange(projection.index, this.row)?.id
        : null,
    ]);
    if (this.cache?.index === projection.index && this.cache.key === key) {
      this.publish({
        phase: 'current',
        projection,
        matches: this.cache.matches,
        message: this.state.message.startsWith('Wrapped')
          ? this.state.message
          : '',
      });
      return;
    }
    this.publish({
      phase: 'pending',
      projection: null,
      matches: [],
      active: -1,
      message: 'Searching current text…',
    });
    const sequence = this.sequence;
    const slices = findSlices(projection.index, options, this.row);
    const matches: FindMatch[] = [];
    const step = () => {
      this.timer = null;
      if (
        !this.live ||
        sequence !== this.sequence ||
        !this.isCurrent(projection)
      )
        return;
      try {
        const started = performance.now();
        for (let n = 0; n < 256; n++) {
          const slice = slices.next();
          if (slice.done) {
            const frozen = Object.freeze(matches);
            this.cache = { index: projection.index, key, matches: frozen };
            this.publish({
              phase: 'current',
              projection,
              matches: frozen,
              message: '',
            });
            return;
          }
          matches.push(...slice.value);
          if (performance.now() - started >= 8) break;
        }
        this.timer = setTimeout(step, 0);
      } catch (error) {
        this.publish({
          phase: 'unavailable',
          projection: null,
          matches: [],
          active: -1,
          message: error instanceof Error ? error.message : 'Find unavailable.',
        });
      }
    };
    this.timer = setTimeout(step, 0);
  }
  navigate(
    direction: 1 | -1,
    apply: (projection: ManuscriptProjection, match: FindMatch) => boolean,
    index?: number,
  ): boolean {
    const { projection, matches, active } = this.state;
    if (
      this.state.phase !== 'current' ||
      !this.isCurrent(projection) ||
      !projection ||
      !matches.length
    )
      return false;
    const next =
      index ??
      (active < 0
        ? direction === 1
          ? 0
          : matches.length - 1
        : (active + direction + matches.length) % matches.length);
    if (
      !Number.isInteger(next) ||
      !matches[next] ||
      !apply(projection, matches[next]!)
    )
      return false;
    // Navigation synchronously invalidates the projection through editor observers.
    this.publish({
      active: next,
      message:
        index === undefined &&
        active >= 0 &&
        ((direction === 1 && next <= active) ||
          (direction === -1 && next >= active))
          ? 'Wrapped to the other end.'
          : '',
    });
    return true;
  }
  dispose() {
    this.cancel();
    this.live = false;
    this.cache = null;
  }
}

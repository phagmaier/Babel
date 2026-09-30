import {
  evaluateScriptCheck,
  type CheckIssue,
  type CheckReport,
} from '../domain/scriptCheck';
import type {
  ManuscriptProjection,
  ManuscriptStamp,
  ProjectionState,
} from './manuscriptProjection';

export type CheckPhase =
  'idle' | 'pending' | 'current' | 'stale' | 'unavailable';
export interface CheckState {
  readonly phase: CheckPhase;
  readonly projection: ManuscriptProjection | null;
  readonly report: CheckReport | null;
  readonly dismissed: readonly string[];
  readonly showWarnings: boolean;
  readonly showAdvisories: boolean;
  readonly message: string;
}

/** Issues surviving severity filters and advisory dismissal. */
export function visibleIssues(state: CheckState): readonly CheckIssue[] {
  if (!state.report) return [];
  const dismissed = new Set(state.dismissed);
  return state.report.issues.filter(
    (issue) =>
      !dismissed.has(issue.key) &&
      ((issue.severity === 'warning' && state.showWarnings) ||
        (issue.severity === 'advisory' && state.showAdvisories)),
  );
}

/**
 * One on-demand evaluation over the current manuscript projection. Pure rule
 * work runs synchronously off the typing path; only explicit Run/Refresh
 * evaluates. No source, file, cursor or network effects.
 */
export class ScriptCheckController {
  state: CheckState = {
    phase: 'idle',
    projection: null,
    report: null,
    dismissed: [],
    showWarnings: true,
    showAdvisories: true,
    message: 'Run Script Check against the current script.',
  };
  private live = true;
  private source: ProjectionState | null = null;
  constructor(
    private readonly stamp: () => ManuscriptStamp | null,
    private readonly changed: (state: CheckState) => void,
  ) {}
  private publish(patch: Partial<CheckState>) {
    if (!this.live) return;
    this.state = Object.freeze({ ...this.state, ...patch });
    this.changed(this.state);
  }
  isCurrent(projection = this.state.projection): boolean {
    const stamp = this.stamp();
    return (
      this.live &&
      !!projection &&
      !!stamp &&
      stamp.session === projection.session &&
      stamp.version === projection.version &&
      stamp.doc === projection.doc
    );
  }
  setProjection(source: ProjectionState) {
    this.source = source;
    const projection = source.projection;
    const retained = this.state.projection;
    if (
      source.phase === 'current' &&
      projection &&
      this.isCurrent(projection) &&
      retained &&
      this.isCurrent(retained)
    )
      return;
    if (
      source.phase === 'current' &&
      projection &&
      retained &&
      this.isCurrent(projection) &&
      projection.session === retained.session &&
      projection.doc === retained.doc
    ) {
      // Selection-only drift on the identical document (for example Go to
      // Issue navigation): rebase without stale-ing; content is unchanged.
      if (projection !== retained) this.publish({ projection });
      return;
    }
    if (!this.state.report) {
      this.publish({
        phase: source.phase === 'unavailable' ? 'unavailable' : 'pending',
        projection: null,
        message:
          'Script Check is waiting for current captured text. Earlier results cannot navigate.',
      });
      return;
    }
    if (source.phase === 'pending') {
      // A capture in flight resolves on its own; retained results stay visible
      // while navigation refuses them, instead of flashing stale and back.
      return;
    }
    // Unavailable captures and newer content/sessions keep the last evaluated
    // results visibly stale; navigation refuses them.
    this.publish({
      phase: 'stale',
      message:
        'The script changed since this check. Refresh to recompute; earlier results cannot navigate.',
    });
  }
  run() {
    const projection = this.source?.projection;
    if (
      this.source?.phase !== 'current' ||
      !projection ||
      !this.isCurrent(projection)
    ) {
      this.publish({
        phase: this.source?.phase === 'unavailable' ? 'unavailable' : 'pending',
        projection: null,
        report: null,
        dismissed: [],
        message:
          'Script Check is waiting for current captured text. Earlier results cannot navigate.',
      });
      return;
    }
    const report = evaluateScriptCheck(projection.snapshot.capture.document);
    const kept = new Set(report.issues.map((issue) => issue.key));
    this.publish({
      phase: 'current',
      projection,
      report,
      dismissed: this.state.dismissed.filter((key) => kept.has(key)),
      message: '',
    });
  }
  dismiss(key: string) {
    const issue = this.state.report?.issues.find(
      (candidate) => candidate.key === key,
    );
    // Only advisories are dismissible; warnings stay until the source changes.
    if (!issue || issue.severity !== 'advisory') return;
    if (this.state.dismissed.includes(key)) return;
    this.publish({ dismissed: [...this.state.dismissed, key] });
  }
  restore() {
    if (!this.state.dismissed.length) return;
    this.publish({ dismissed: [] });
  }
  configure(showWarnings: boolean, showAdvisories: boolean) {
    this.publish({ showWarnings, showAdvisories });
  }
  dispose() {
    this.live = false;
  }
}

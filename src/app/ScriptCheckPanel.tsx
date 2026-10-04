import { useEffect } from 'react';
import {
  visibleIssues,
  type ScriptCheckController,
  type CheckState,
} from '../application/scriptCheck';
import type { CheckIssue } from '../domain/scriptCheck';
import { describeOmissions } from '../domain/exportAssessment';

const codeLabels: Record<CheckIssue['code'], string> = {
  SC001: 'Cue without dialogue',
  SC002: 'Parenthetical without dialogue',
  SC003: 'Broken dual dialogue',
  SC004: 'Raw source needs review',
  SC005: 'Publication content limitation',
  SC008: 'Font or shaping limitation',
  SC006: 'Duplicate scene number',
  SC007: 'Suspicious spacing',
};

export function ScriptCheckPanel({
  controller,
  state,
  disabled,
  onNavigate,
  onClose,
}: {
  controller: ScriptCheckController;
  state: CheckState;
  disabled: boolean;
  onNavigate: (issue: CheckIssue) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    // Run once against the projection that opened the panel; Refresh re-runs.
    controller.run();
  }, []);
  const current = state.phase === 'current';
  const stale = state.phase === 'stale';
  const shown = current || stale;
  const visible = visibleIssues(state);
  const blockers = visible.filter((issue) => issue.severity === 'blocking');
  const assessment = state.report?.exportAssessment;
  const omitted =
    assessment?.status === 'verified'
      ? describeOmissions(assessment.omissions)
      : '';
  const warnings = visible.filter((issue) => issue.severity === 'warning');
  const advisories = visible.filter((issue) => issue.severity === 'advisory');
  const navigable = current && controller.isCurrent(state.projection);
  const grouped = new Map<CheckIssue['code'], CheckIssue[]>();
  for (const issue of visible) {
    const group = grouped.get(issue.code) ?? [];
    group.push(issue);
    grouped.set(issue.code, group);
  }
  return (
    <section
      className="check-panel"
      aria-label="Script Check"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <h2>Script Check</h2>
      <p>
        Publication limitations, structural warnings and dismissible style
        advisories over the current script. Checks never change source, files or
        the cursor, and warnings never block saving. This baseline offers no
        automatic fixes.
      </p>
      <p role="status" aria-live="polite">
        {shown && state.report
          ? `${warnings.length} warnings · ${advisories.length} advisories${state.dismissed.length ? ` · ${state.dismissed.length} dismissed` : ''}${blockers.length ? ` · ${blockers.length} export limitations` : ''}${stale ? ' · stale, refresh to recompute' : ''}.`
          : state.message}
      </p>
      <button
        type="button"
        disabled={disabled}
        aria-disabled={state.phase === 'pending'}
        onClick={() => {
          if (state.phase !== 'pending') controller.run();
        }}
      >
        Refresh check
      </button>
      <label>
        <input
          type="checkbox"
          checked={state.showWarnings}
          onChange={(e) =>
            controller.configure(e.target.checked, state.showAdvisories)
          }
        />
        Show warnings
      </label>
      <label>
        <input
          type="checkbox"
          checked={state.showAdvisories}
          onChange={(e) =>
            controller.configure(state.showWarnings, e.target.checked)
          }
        />
        Show advisories
      </label>
      <button type="button" onClick={onClose}>
        Close Script Check
      </button>
      {state.dismissed.length > 0 && (
        <button type="button" onClick={() => controller.restore()}>
          Restore dismissed ({state.dismissed.length})
        </button>
      )}
      {shown &&
        [...grouped.entries()].map(([code, issues]) => (
          <section key={code} aria-label={`${codeLabels[code]} issues`}>
            <h3>
              {code} · {codeLabels[code]} ({issues.length})
            </h3>
            <ol>
              {issues.map((issue) => (
                <li key={issue.key}>
                  <p>{issue.message}</p>
                  <p>
                    {issue.explanation}{' '}
                    {issue.line !== null
                      ? `Row ${issue.line + 1}${issue.endLine !== issue.line ? `–${issue.endLine + 1}` : ''}.`
                      : 'Whole document.'}
                  </p>
                  <button
                    type="button"
                    disabled={disabled || !navigable || issue.line === null}
                    onClick={() => onNavigate(issue)}
                  >
                    Go to issue
                  </button>
                  {issue.severity === 'advisory' && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => controller.dismiss(issue.key)}
                    >
                      Dismiss
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
      <section aria-label="Export assessment">
        <h3>
          {state.phase === 'pending'
            ? 'Export assessment updating'
            : stale
              ? 'Export assessment stale'
              : assessment?.status === 'verified'
                ? 'Export support assessed'
                : 'Export assessment unavailable'}
        </h3>
        {assessment?.status === 'verified' ? (
          <>
            <p>
              {assessment.issues.length} publication limitations for version{' '}
              {assessment.version}.
              {assessment.layout === 'unavailable'
                ? ' Layout assessment unavailable.'
                : ' Frozen layout checks complete.'}{' '}
              This check does not certify a PDF export. Saving remains
              available.
            </p>
            {omitted && <p>{omitted}</p>}
            <p>
              {assessment.provenance.profile} · Screenplain{' '}
              {assessment.provenance.renderer.screenplain} / ReportLab{' '}
              {assessment.provenance.renderer.reportlab} ·{' '}
              {assessment.provenance.fontSet}
            </p>
          </>
        ) : (
          <p>
            {assessment?.reason ??
              'SC005/SC008 need a matching verified renderer, profile and pinned font identity.'}
          </p>
        )}
        {state.report?.truncated && (
          <p>
            Results are limited to 1,000 issues; more limitations may remain.
          </p>
        )}
      </section>
    </section>
  );
}

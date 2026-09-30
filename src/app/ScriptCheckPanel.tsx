import { useEffect } from 'react';
import {
  visibleIssues,
  type ScriptCheckController,
  type CheckState,
} from '../application/scriptCheck';
import type { CheckIssue } from '../domain/scriptCheck';

const codeLabels: Record<CheckIssue['code'], string> = {
  SC001: 'Cue without dialogue',
  SC002: 'Parenthetical without dialogue',
  SC003: 'Broken dual dialogue',
  SC004: 'Raw source needs review',
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
        Structural warnings and dismissible style advisories over the current
        script. Checks never change source, files or the cursor, and warnings
        never block saving. This baseline offers no automatic fixes.
      </p>
      <p role="status" aria-live="polite">
        {shown && state.report
          ? `${warnings.length} warnings · ${advisories.length} advisories${state.dismissed.length ? ` · ${state.dismissed.length} dismissed` : ''}${stale ? ' · stale, refresh to recompute' : ''}.`
          : state.message}
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => controller.run()}
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
        <h3>Export assessment unavailable</h3>
        <p>
          Renderer limitations (SC005) and font coverage (SC008) need the
          verified production renderer, profile and font set. Until M5 connects
          them, Script Check cannot assess them and never implies export
          success.
        </p>
      </section>
    </section>
  );
}

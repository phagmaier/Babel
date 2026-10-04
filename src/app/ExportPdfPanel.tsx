import { useState } from 'react';
import type {
  ExportPdfController,
  ExportPdfState,
} from '../application/exportPdf';
import { describeOmissions } from '../domain/exportAssessment';
import { requiresExportReview } from '../domain/scriptCheck';
export function ExportPdfPanel({
  controller,
  state,
  onDismiss,
}: {
  controller: ExportPdfController;
  state: ExportPdfState;
  onDismiss: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const issues = state.report?.issues ?? [];
  const needsAcknowledgement =
    !!state.report && requiresExportReview(state.report);
  const review = state.phase === 'review';
  const assessment = state.report?.exportAssessment;
  // Shown in every phase: a capture with nothing to review skips this panel's
  // review step, and the author still sees what the profile leaves out.
  const omitted =
    assessment?.status === 'verified'
      ? describeOmissions(assessment.omissions)
      : '';
  return (
    <section className="export-pdf-panel" aria-label="PDF export">
      <h2>
        Export PDF{state.version ? ` · captured version ${state.version}` : ''}
      </h2>
      <p role="status">{state.message}</p>
      {omitted && <p>{omitted}</p>}
      {review && (
        <>
          <p>
            US Letter draft · Courier Prime · Screenplain 0.12.0. The PDF uses
            this protected capture; you can continue editing and saving.
          </p>
          <p>
            Review the warnings and limitations below before choosing a
            destination. Accepting them does not change the script; glyph,
            shaping or layout refusals still prevent rendering.
          </p>
          <ol>
            {issues.map((issue) => (
              <li key={issue.key}>
                <strong>
                  {issue.code} · {issue.severity}
                  {issue.line !== null ? ` · line ${issue.line + 1}` : ''}
                </strong>
                : {issue.message} <span>{issue.explanation}</span>
                {issue.sourceStart !== undefined
                  ? ` Source bytes ${issue.sourceStart}–${issue.sourceEnd}.`
                  : ''}
              </li>
            ))}
          </ol>
          {needsAcknowledgement && (
            <label>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />{' '}
              I have reviewed the warnings and accept the reported limitations
              for this PDF.
            </label>
          )}
          <button
            type="button"
            disabled={needsAcknowledgement && !acknowledged}
            onClick={() => void controller.proceed(acknowledged)}
          >
            Choose PDF destination
          </button>
        </>
      )}
      {controller.busy ? (
        <button
          type="button"
          disabled={state.phase === 'publishing' || state.phase === 'cancelled'}
          onClick={() => void controller.cancel()}
        >
          Cancel export
        </button>
      ) : (
        <button type="button" onClick={onDismiss}>
          Dismiss export status
        </button>
      )}
    </section>
  );
}

import { useState } from 'react';
import type {
  ExportPdfController,
  ExportPdfState,
} from '../application/exportPdf';
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
  const needsAcknowledgement = issues.some((i) => i.severity !== 'advisory');
  const review = state.phase === 'review';
  return (
    <section className="export-pdf-panel" aria-label="PDF export">
      <h2>
        Export PDF{state.version ? ` · captured version ${state.version}` : ''}
      </h2>
      <p role="status">{state.message}</p>
      {review && (
        <>
          <p>
            US Letter draft · Courier Prime · Screenplain 0.12.0. The PDF uses
            this protected capture; you can continue editing and saving.
          </p>
          <p>
            Section and synopsis markers, notes, boneyards and page breaks
            follow the selected profile. Reported omissions can be accepted;
            glyph, shaping or layout refusals still prevent rendering.
          </p>
          {issues.length ? (
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
          ) : (
            <p>
              No publication limitations or structural warnings were found in
              this capture.
            </p>
          )}
          {needsAcknowledgement && (
            <label>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />{' '}
              I have reviewed the warnings and accept the reported limitations
              or omissions for this PDF.
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

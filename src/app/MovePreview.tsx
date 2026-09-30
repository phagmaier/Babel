import { useState } from 'react';
import type { PreparedMove } from '../editor/sceneMoves';
const decode = (bytes: Uint8Array) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
function ReviewCopy({ bytes, name }: { bytes: Uint8Array; name: string }) {
  return (
    <details>
      <summary>
        {name} source review copy ({bytes.length} bytes)
      </summary>
      <textarea
        readOnly
        aria-label={`${name} source review copy`}
        value={decode(bytes)}
        rows={8}
      />
    </details>
  );
}
export function MovePreview({
  move,
  stale,
  busy,
  message,
  onApply,
  onCancel,
}: {
  move: PreparedMove;
  stale: boolean;
  busy: boolean;
  message: string;
  onApply: () => void;
  onCancel: () => void;
}) {
  const review = move.review;
  // Materialize immutable review copies once per plan, not every progress render.
  const [copies] = useState(() => ({
    original: review.originalBytes,
    candidate: review.candidateBytes,
    moved: review.movedBytes,
  }));
  const movedAmbiguous = review.ambiguities.filter((a) => a.moves).length;
  return (
    <section className="move-preview" aria-label="Move preview">
      <h3>Move {review.kind} preview</h3>
      <p>
        Moves physical rows {review.from + 1}–{review.to}: {review.rows} rows,{' '}
        {review.byteLength} source bytes.{' '}
        {review.kind === 'section'
          ? 'Includes the entire nested subtree.'
          : 'Stops before the next scene or section heading.'}
      </p>
      <p>
        Synopsis, notes and blanks keep their preceding heading owner. Boundary
        attachments: {movedAmbiguous} move,{' '}
        {review.ambiguities.length - movedAmbiguous} stay. Inspect the complete
        source below; no separators or markers are changed.
      </p>
      {review.ambiguities.length > 0 && (
        <details>
          <summary>Ambiguous attachment rows</summary>
          <textarea
            readOnly
            aria-label="Ambiguous attachment rows"
            rows={4}
            value={review.ambiguities
              .map(
                (a) => `${a.from + 1}–${a.to}: ${a.moves ? 'moves' : 'stays'}`,
              )
              .join('\n')}
          />
        </details>
      )}
      <label>
        Exact moved source
        <textarea
          readOnly
          aria-label="Exact moved source"
          value={decode(copies.moved)}
          rows={8}
        />
      </label>
      <ReviewCopy bytes={copies.original} name="Original" />
      {copies.candidate && (
        <ReviewCopy bytes={copies.candidate} name="Candidate" />
      )}
      <p role={review.status === 'refused' || stale ? 'alert' : 'status'}>
        {stale
          ? 'Move preview is stale. Cancel and create a new preview; source and review copies retained.'
          : review.reason}
      </p>
      {move.large && (
        <p>
          The exact current draft needs a recovery checkpoint and safety
          revision before this large move.
        </p>
      )}
      <button
        type="button"
        disabled={busy || stale || review.status !== 'ready'}
        onClick={onApply}
      >
        Apply move
      </button>
      <button type="button" onClick={onCancel}>
        {busy ? 'Cancel move protection' : 'Cancel move preview'}
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}

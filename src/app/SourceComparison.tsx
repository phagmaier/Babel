import { useMemo, useState } from 'react';

/** Decode comparisons only when requested, outside the ordinary typing/render path. */
export function SourceComparison({
  draft,
  disk,
}: {
  draft: readonly number[];
  disk: readonly number[];
}) {
  const [open, setOpen] = useState(false);
  const text = useMemo(
    () =>
      open
        ? {
            draft: new TextDecoder().decode(Uint8Array.from(draft)),
            disk: new TextDecoder().decode(Uint8Array.from(disk)),
          }
        : null,
    [open, draft, disk],
  );
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Compare draft and source file</summary>
      {text && (
        <>
          <h3>Your draft</h3>
          <pre>{text.draft}</pre>
          <h3>Source file</h3>
          <pre>{text.disk}</pre>
        </>
      )}
    </details>
  );
}

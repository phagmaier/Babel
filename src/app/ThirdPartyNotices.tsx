import { useEffect, useRef, useState } from 'react';
import type {
  ThirdPartyNoticesPort,
  ThirdPartyNoticesResult,
} from '../application/thirdPartyNotices';

/** Read-only third-party notices dialog. Loads lazily on first open and
 *  renders the retained notice text; never edits, saves or leaves the app. */
export function ThirdPartyNotices({
  port,
  open,
  onClose,
}: {
  port: ThirdPartyNoticesPort;
  open: boolean;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [result, setResult] = useState<ThirdPartyNoticesResult | null>(null);
  useEffect(() => {
    closeButton.current?.focus();
    if (!open) return;
    let live = true;
    setResult(null);
    void port
      .read()
      .then((value) => {
        if (live) setResult(value);
      })
      .catch(() => {
        if (live)
          setResult({
            status: 'unavailable',
            reason:
              'Third-party notices ship with the installed package; they are unavailable here.',
          });
      });
    return () => {
      live = false;
    };
  }, [open, port]);
  if (!open) return null;
  return (
    <section
      className="third-party-notices"
      aria-label="Third-party notices"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <h2>Third-party notices</h2>
      {result === null ? (
        <p role="status">Reading notices…</p>
      ) : result.status === 'ready' ? (
        <details>
          <summary>Bundled library licences</summary>
          <pre>{result.text}</pre>
        </details>
      ) : (
        <p role="alert">{result.reason}</p>
      )}
      <button type="button" ref={closeButton} onClick={onClose}>
        Close notices
      </button>
    </section>
  );
}

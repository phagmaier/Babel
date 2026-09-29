import type { CadenceStatus } from '../application/saveCadence';

/**
 * Visible protection state. Recovery, source-file and snapshot facts stay
 * separate; a queued job or an old check never renders as saved.
 */
export function SaveStatus({ status }: { status: CadenceStatus }) {
  return (
    <section aria-label="Save status">
      <p role="status">
        {status.status} — live version {status.liveVersion}, recovery version{' '}
        {status.journaledVersion}, file-saved version {status.fileSavedVersion}.
      </p>
      {status.snapshotAttention && (
        <p role="alert">
          Snapshots need attention. Source and recovery protection above are
          unaffected.
        </p>
      )}
    </section>
  );
}

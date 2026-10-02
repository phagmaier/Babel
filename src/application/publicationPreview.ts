import type { DocumentIdentity } from './documents';
import type {
  ManuscriptProjection,
  ManuscriptStamp,
  ProjectionState,
} from './manuscriptProjection';
import { sameIdentity } from './persistenceState';
import {
  PublicationController,
  type PublicationPreviewPort,
  type PublicationResult,
} from './publication';

export interface PreviewArtifact {
  readonly result: PublicationResult;
  readonly bytes: Uint8Array;
  readonly stamp: ManuscriptStamp;
}
export interface PublicationPreviewState {
  readonly enabled: boolean;
  readonly phase: 'closed' | 'updating' | 'ready' | 'failed';
  readonly artifact: PreviewArtifact | null;
  readonly message: string;
}
/** Only existing deferred captures enter this controller. No capture/layout on keys. */
export class PublicationPreviewController {
  state: PublicationPreviewState = {
    enabled: false,
    phase: 'closed',
    artifact: null,
    message: 'Pages: open PDF preview',
  };
  private disposed = false;
  private captureUnavailable = false;
  private sequence = 0;
  private artifactSequence = -1;
  private requestedProjection: ManuscriptProjection | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private projection: ManuscriptProjection | null = null;
  private controller: PublicationController | null = null;
  private identity: DocumentIdentity | null = null;
  constructor(
    private readonly port: PublicationPreviewPort,
    private readonly current: () => {
      stamp: ManuscriptStamp;
      identity: DocumentIdentity;
    } | null,
    private readonly changed: (state: PublicationPreviewState) => void,
  ) {}
  private update(state: PublicationPreviewState) {
    if (this.disposed) return;
    this.state = state;
    this.changed(state);
  }
  private matches(stamp: ManuscriptStamp) {
    const now = this.current();
    return (
      now &&
      now.stamp.session === stamp.session &&
      now.stamp.doc === stamp.doc &&
      now.stamp.version === stamp.version &&
      this.identity &&
      sameIdentity(now.identity, this.identity)
    );
  }
  private stop() {
    ++this.sequence;
    this.requestedProjection = null;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    // Invalidate synchronously; native cancellation runs away from typing.
    const controller = this.controller;
    if (controller)
      setTimeout(() => {
        void controller.cancel().catch(() => {});
      }, 0);
  }
  invalidate() {
    if (this.disposed || !this.state.enabled) return;
    this.projection = null;
    this.stop();
    if (this.state.phase !== 'updating')
      this.update({
        ...this.state,
        phase: 'updating',
        message: 'Updating · earlier preview is stale',
      });
  }
  accept(state: ProjectionState) {
    if (this.disposed) return;
    this.captureUnavailable = state.phase === 'unavailable';
    if (state.phase !== 'current' || !state.projection) {
      this.projection = null;
      this.invalidate();
      if (state.phase === 'unavailable' && this.state.enabled)
        this.fail(
          'Current source cannot be captured. Editing and Save remain available.',
        );
      return;
    }
    this.projection = state.projection;
    if (!this.state.enabled) return;
    if (this.requestedProjection && this.matches(this.requestedProjection))
      return;
    if (
      this.state.artifact &&
      this.matches(this.state.artifact.stamp) &&
      this.state.phase === 'ready'
    )
      return;
    this.schedule();
  }
  open() {
    if (this.disposed || this.state.enabled) return;
    this.update({
      enabled: true,
      phase: 'updating',
      artifact: null,
      message: 'Updating',
    });
    if (this.captureUnavailable) {
      this.fail(
        'Current source cannot be captured. Editing and Save remain available.',
      );
      return;
    }
    this.schedule();
  }
  refresh() {
    if (!this.disposed && this.state.enabled) {
      this.stop();
      this.update({ ...this.state, phase: 'updating', message: 'Updating' });
      if (this.captureUnavailable) {
        this.fail(
          'Current source cannot be captured. Editing and Save remain available.',
        );
        return;
      }
      this.schedule();
    }
  }
  private schedule() {
    if (!this.projection || this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      const projection = this.projection;
      const now = this.current();
      if (
        !projection ||
        !now ||
        now.stamp.doc !== projection.doc ||
        now.stamp.session !== projection.session ||
        now.stamp.version !== projection.version
      )
        return;
      if (!this.identity || !sameIdentity(this.identity, now.identity)) {
        void this.controller?.close().catch(() => {});
        this.identity = now.identity;
        this.controller = new PublicationController(now.identity, this.port);
      }
      this.requestedProjection = projection;
      const sequence = ++this.sequence;
      const controller = this.controller!;
      void (async () => {
        try {
          const result = await controller.render(projection.snapshot);
          if (
            this.disposed ||
            sequence !== this.sequence ||
            !this.matches(projection)
          )
            return;
          const bytes = await this.port.read({
            identity: result.identity,
            requestId: result.requestId,
            artifact: result.artifact,
          });
          if (
            this.disposed ||
            sequence !== this.sequence ||
            !this.matches(projection)
          )
            return;
          if (
            bytes.length > 32 * 1024 * 1024 ||
            new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-'
          )
            throw new Error('invalid PDF');
          this.artifactSequence = sequence;
          this.update({
            enabled: true,
            phase: 'updating',
            artifact: { result, bytes, stamp: projection },
            message: 'Updating · displaying captured PDF',
          });
        } catch {
          if (
            !this.disposed &&
            sequence === this.sequence &&
            this.matches(projection)
          )
            this.fail(
              'PDF preview failed. Editing and Save remain available. Retry or run Script Check for publication limitations.',
            );
        }
      })();
    }, 750);
  }
  displayed(artifact: PreviewArtifact, pages: number) {
    if (
      this.disposed ||
      this.artifactSequence !== this.sequence ||
      artifact !== this.state.artifact ||
      !this.matches(artifact.stamp)
    )
      return;
    if (pages !== artifact.result.pageCount) {
      this.fail(
        'PDF page count disagrees with the renderer. Editing and Save remain available.',
      );
      return;
    }
    this.update({
      ...this.state,
      phase: 'ready',
      message: `${pages} ${pages === 1 ? 'page' : 'pages'} · preview version ${artifact.result.version}`,
    });
  }
  displayFailed(artifact: PreviewArtifact) {
    if (
      !this.disposed &&
      this.artifactSequence === this.sequence &&
      this.state.artifact === artifact &&
      this.matches(artifact.stamp)
    )
      this.fail('PDF viewer failed. Editing and Save remain available.');
  }
  private fail(message: string) {
    this.update({ ...this.state, phase: 'failed', message });
  }
  close() {
    this.stop();
    this.update({
      enabled: false,
      phase: 'closed',
      artifact: null,
      message: 'Pages: open PDF preview',
    });
  }
  dispose() {
    this.close();
    this.disposed = true;
    void this.controller?.close().catch(() => {});
  }
}

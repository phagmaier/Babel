import type {
  CheckpointReceipt,
  CheckpointRequest,
  DocumentIdentity,
} from './documents';
import type { CapturedSnapshot } from './persistenceController';
import type { PublicationRequest, PublicationResult } from './publication';
import type { PublicationPreviewController } from './publicationPreview';
import type { ExportAssessmentPort } from './exportAssessment';
import { assessmentLayoutProbes } from '../domain/exportAssessment';
import { parseFountain } from '../domain/fountainCodec';
import { evaluateScriptCheck, type CheckReport } from '../domain/scriptCheck';
import { sameIdentity, validHash } from './persistenceState';
export interface PdfCaptureReceipt {
  identity: DocumentIdentity;
  captureToken: string;
  version: number;
  sourceSha256: string;
  checkpoint: CheckpointReceipt;
}
export interface PdfTarget {
  token: string;
  fileName: string;
  replacesExisting: boolean;
}
export interface PdfExportReceipt {
  publication: {
    fileName: string;
    pdfSha256: string;
    byteLength: number;
    previousFileName: string | null;
  };
  result: PublicationResult;
}
export interface ExportPdfPort {
  prepare(checkpoint: CheckpointRequest): Promise<PdfCaptureReceipt>;
  select(request: {
    identity: DocumentIdentity;
    captureToken: string;
  }): Promise<PdfTarget | null>;
  render(request: {
    identity: DocumentIdentity;
    captureToken: string;
    requestId: number;
  }): Promise<PublicationResult>;
  publish(request: {
    identity: DocumentIdentity;
    captureToken: string;
    destinationToken: string;
    requestId: number;
    artifact: string;
    acknowledged: true;
  }): Promise<PdfExportReceipt>;
  cancel(request: {
    identity: DocumentIdentity;
    captureToken: string;
  }): Promise<void>;
}
export interface ExportPdfState {
  phase:
    | 'idle'
    | 'capturing'
    | 'checking'
    | 'review'
    | 'selecting'
    | 'rendering'
    | 'publishing'
    | 'succeeded'
    | 'cancelled'
    | 'failed';
  message: string;
  version: number | null;
  report: CheckReport | null;
  receipt: PdfExportReceipt | null;
}
export class ExportPdfController {
  state: ExportPdfState = {
    phase: 'idle',
    message: '',
    version: null,
    report: null,
    receipt: null,
  };
  private capture: {
    snapshot: CapturedSnapshot;
    receipt: PdfCaptureReceipt;
  } | null = null;
  private serial = 0;
  private cancelled = false;
  private working = false;
  private disposed = false;
  constructor(
    private readonly port: ExportPdfPort,
    private readonly assessment: ExportAssessmentPort,
    private readonly publication: PublicationPreviewController,
    private readonly changed: (state: ExportPdfState) => void,
  ) {}
  get busy() {
    return (
      this.working ||
      [
        'capturing',
        'checking',
        'review',
        'selecting',
        'rendering',
        'publishing',
      ].includes(this.state.phase)
    );
  }
  private set(patch: Partial<ExportPdfState>) {
    this.state = Object.freeze({ ...this.state, ...patch });
    if (!this.disposed) this.changed(this.state);
  }
  private live(serial: number) {
    return !this.disposed && !this.cancelled && serial === this.serial;
  }
  async start(
    capture: () => Promise<{
      snapshot: CapturedSnapshot;
      receipt: PdfCaptureReceipt;
    }>,
  ) {
    if (this.busy || this.disposed) return;
    const serial = ++this.serial;
    this.cancelled = false;
    this.working = true;
    this.set({
      phase: 'capturing',
      message: 'Protecting the captured source…',
      version: null,
      report: null,
      receipt: null,
    });
    try {
      await this.publication.beginExport();
      if (!this.live(serial)) return;
      const captured = await capture();
      this.capture = {
        receipt: captured.receipt,
        snapshot: Object.freeze({
          ...captured.snapshot,
          source: Object.freeze([...captured.snapshot.source]),
        }),
      };
      if (!this.live(serial)) return;
      const { snapshot } = this.capture;
      this.set({
        phase: 'checking',
        version: snapshot.version,
        message: `Checking captured version ${snapshot.version}…`,
      });
      const doc = parseFountain(Uint8Array.from(snapshot.source));
      const probes = assessmentLayoutProbes(doc);
      const assessed = await this.assessment.assess(
        probes.map((p) => p.source),
      );
      if (!this.live(serial)) return;
      const report = evaluateScriptCheck(doc, {
        identity: assessed.identity,
        layout: assessed.layout,
        version: snapshot.version,
        sourceSha256: snapshot.sourceSha256,
      });
      const assessment = report.exportAssessment;
      if (
        assessment.status !== 'verified' ||
        assessment.layout !== 'verified' ||
        assessment.truncated ||
        report.truncated
      )
        throw new Error(
          'Publication assessment is unavailable or incomplete. No PDF was exported.',
        );
      this.set({
        phase: 'review',
        report,
        message: `Review captured version ${snapshot.version}. Later edits will stay in the editor.`,
      });
    } catch (error) {
      if (this.live(serial)) this.failure(error);
    } finally {
      if (this.state.phase !== 'review') await this.cleanup();
      this.working = false;
      this.set({});
    }
  }
  async proceed(acknowledged: boolean) {
    if (
      this.working ||
      this.state.phase !== 'review' ||
      !this.capture ||
      this.disposed
    )
      return;
    const report = this.state.report;
    if (
      !report ||
      report.exportAssessment.status !== 'verified' ||
      report.exportAssessment.layout !== 'verified'
    )
      return;
    if (report.issues.some((i) => i.severity !== 'advisory') && !acknowledged)
      return;
    const serial = this.serial;
    this.working = true;
    const { snapshot, receipt } = this.capture;
    const authority = {
      identity: receipt.identity,
      captureToken: receipt.captureToken,
    };
    try {
      this.set({
        phase: 'selecting',
        message: `Choose a destination for version ${snapshot.version}…`,
      });
      const target = await this.port.select(authority);
      if (!this.live(serial)) return;
      if (!target) {
        this.cancelled = true;
        this.set({
          phase: 'cancelled',
          message: 'PDF export cancelled. No destination was written.',
        });
        return;
      }
      this.set({
        phase: 'rendering',
        message: `Rendering captured version ${snapshot.version}…`,
      });
      const result = await this.publication.renderExport(
        snapshot,
        (request: PublicationRequest) =>
          this.port.render({ ...authority, requestId: request.requestId }),
      );
      if (!this.live(serial)) return;
      this.set({
        phase: 'publishing',
        message: `Writing ${target.fileName} atomically. Publication has started; cancellation is unavailable.`,
      });
      const published = await this.port.publish({
        ...authority,
        destinationToken: target.token,
        requestId: result.requestId,
        artifact: result.artifact,
        acknowledged: true,
      });
      if (
        !sameIdentity(published.result.identity, receipt.identity) ||
        published.result.version !== snapshot.version ||
        published.result.sourceSha256 !== snapshot.sourceSha256 ||
        published.result.requestId !== result.requestId ||
        published.result.artifact !== result.artifact ||
        published.result.pageCount !== result.pageCount ||
        !validHash(published.publication.pdfSha256) ||
        published.publication.byteLength <= 0 ||
        published.publication.fileName !== target.fileName
      )
        throw new Error(
          'The publication receipt could not be verified. Inspect the selected destination before retrying.',
        );
      this.set({
        phase: 'succeeded',
        receipt: published,
        message: `Exported ${target.fileName} · version ${result.version} · ${result.pageCount} ${result.pageCount === 1 ? 'page' : 'pages'}.${published.publication.previousFileName ? ' Previous PDF retained as ' + published.publication.previousFileName + '.' : ''}`,
      });
      this.capture = null;
    } catch (error) {
      if (this.live(serial)) this.failure(error);
    } finally {
      await this.cleanup();
      this.working = false;
      this.set({});
    }
  }
  private failure(error: unknown) {
    const reason =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'code' in error
          ? String(error.code)
          : 'Publication failed';
    this.set({
      phase: 'failed',
      message: `PDF export needs attention: ${reason}. Editing and Save remain available; no export success is confirmed.`,
    });
  }
  async cancel() {
    if (
      !['capturing', 'checking', 'review', 'selecting', 'rendering'].includes(
        this.state.phase,
      )
    )
      return;
    const wasWorking = this.working;
    if (!wasWorking) this.working = true;
    this.cancelled = true;
    this.set({
      phase: 'cancelled',
      message: 'PDF export cancelled. No destination was written.',
    });
    await this.publication.cancelExportRender().catch(() => {});
    if (!wasWorking) {
      await this.cleanup();
      this.working = false;
      this.set({});
    }
  }
  private async cleanup() {
    const capture = this.capture;
    this.capture = null;
    if (capture)
      await this.port
        .cancel({
          identity: capture.receipt.identity,
          captureToken: capture.receipt.captureToken,
        })
        .catch(() => {});
    this.publication.endExport();
    this.set({});
  }
  dispose() {
    this.disposed = true;
    void this.cancel();
  }
}

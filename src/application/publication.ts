/** Publication accepts captured derivatives; it owns no editor or save state. */
import type { CapturedSnapshot } from './persistenceController';
import type { DocumentIdentity } from './documents';
import { MAX_SOURCE_BYTES, sameIdentity, validHash } from './persistenceState';
export const PUBLICATION_PROFILE = 'screenplain-baseline' as const;
export const PUBLICATION_FONT_SET = 'courier-prime-screenplain-0.12.0' as const;
export const PUBLICATION_FONTS = [
  {
    file: 'Courier Prime Bold Italic.ttf',
    sha256: 'cfc77df22c0516962b6ba841e63c59ad8c2f95aff4d7a44f6328eeaaeff7e7d8',
  },
  {
    file: 'Courier Prime Bold.ttf',
    sha256: 'aa5a0a31d25dac006fe2d71fc6ff0feff250bc6de3b3c81b7e9d3a58e1329b52',
  },
  {
    file: 'Courier Prime Italic.ttf',
    sha256: 'e1c9bde2ef55f90a5619cff5dac0d5674700045d666a7d2cddee1879bb83d552',
  },
  {
    file: 'Courier Prime.ttf',
    sha256: '6cc9525b1334047445cba53f323e810331acfdf59f18f4008397d13137737b91',
  },
] as const;
export interface PublicationRequest {
  readonly identity: DocumentIdentity;
  readonly requestId: number;
  readonly version: number;
  readonly source: readonly number[];
  readonly sourceSha256: string;
  readonly profile: typeof PUBLICATION_PROFILE;
  readonly fontSet: typeof PUBLICATION_FONT_SET;
  readonly options: Readonly<Record<string, never>>;
}
export interface PublicationResult {
  readonly identity: DocumentIdentity;
  readonly requestId: number;
  readonly version: number;
  readonly sourceSha256: string;
  readonly sourceBytes: number;
  readonly artifact: string;
  readonly pageCount: number;
  readonly profile: typeof PUBLICATION_PROFILE;
  readonly profileFrozen: false;
  readonly fontSet: typeof PUBLICATION_FONT_SET;
  readonly renderer: { python: string; screenplain: string; reportlab: string };
  readonly fonts: readonly { file: string; sha256: string }[];
  readonly sourceMap: 'unsupported';
  readonly warnings: readonly { code: string; message: string }[];
}
export type PublicationErrorCode =
  | 'queue-full'
  | 'renderer-unavailable'
  | 'invalid-request'
  | 'invalid-identity'
  | 'stale-version'
  | 'cancelled'
  | 'timeout'
  | 'helper-killed'
  | 'helper-crashed'
  | 'invalid-response'
  | 'cache-unavailable'
  | 'bad-request'
  | 'unsupported-protocol'
  | 'unsupported-profile'
  | 'output-invalid'
  | 'output-exists'
  | 'source-too-large'
  | 'invalid-utf8'
  | 'font-integrity'
  | 'render-failed'
  | 'internal';
export class PublicationFailure extends Error {
  constructor(readonly code: PublicationErrorCode) {
    super(code);
    this.name = 'PublicationFailure';
  }
}
export interface PublicationPort {
  render(request: PublicationRequest): Promise<PublicationResult>;
  cancel(request: {
    identity: DocumentIdentity;
    requestId: number;
  }): Promise<void>;
}
/** Latest-result authority; even an adapter returning late success cannot publish it. */
export class PublicationController {
  private serial = 0;
  private latest: PublicationRequest | null = null;
  private closed = false;
  private version = 0;
  private hash = '';
  constructor(
    private readonly identity: DocumentIdentity,
    private readonly port: PublicationPort,
  ) {}
  async render(snapshot: CapturedSnapshot): Promise<PublicationResult> {
    if (this.closed) throw new PublicationFailure('cancelled');
    if (
      !Number.isSafeInteger(snapshot.version) ||
      snapshot.version <= 0 ||
      !validHash(snapshot.sourceSha256) ||
      snapshot.source.length > MAX_SOURCE_BYTES ||
      !snapshot.source.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)
    )
      throw new PublicationFailure('invalid-request');
    if (
      snapshot.version < this.version ||
      (snapshot.version === this.version && snapshot.sourceSha256 !== this.hash)
    )
      throw new PublicationFailure('stale-version');
    // Take an owned copy before awaiting; never consult the live editor.
    const request: PublicationRequest = Object.freeze({
      identity: Object.freeze({ ...this.identity }),
      requestId: ++this.serial,
      version: snapshot.version,
      source: Object.freeze([...snapshot.source]),
      sourceSha256: snapshot.sourceSha256,
      profile: PUBLICATION_PROFILE,
      fontSet: PUBLICATION_FONT_SET,
      options: Object.freeze({}),
    });
    this.version = request.version;
    this.hash = request.sourceSha256;
    this.latest = request;
    const result = await this.port.render(request);
    if (this.closed || this.latest !== request)
      throw new PublicationFailure('cancelled');
    let invalid: boolean;
    try {
      invalid =
        !sameIdentity(result.identity, request.identity) ||
        result.requestId !== request.requestId ||
        result.version !== request.version ||
        result.sourceSha256 !== request.sourceSha256 ||
        result.sourceBytes !== request.source.length ||
        result.profile !== request.profile ||
        result.profileFrozen !== false ||
        result.fontSet !== request.fontSet ||
        result.sourceMap !== 'unsupported' ||
        !/^render-[0-9]+-[0-9]+$/.test(result.artifact) ||
        !Number.isSafeInteger(result.pageCount) ||
        result.pageCount <= 0 ||
        result.renderer.python !== '3.13.16' ||
        result.renderer.screenplain !== '0.12.0' ||
        result.renderer.reportlab !== '4.4.7' ||
        !Array.isArray(result.fonts) ||
        result.fonts.length !== 4 ||
        !result.fonts.every((f) => validHash(f.sha256));
      invalid ||= PUBLICATION_FONTS.some(
        (expected) =>
          result.fonts.filter(
            (font) =>
              font.file === expected.file && font.sha256 === expected.sha256,
          ).length !== 1,
      );
    } catch {
      invalid = true;
      /* A malformed adapter response earns no artifact/count credit. */
    }
    if (invalid) {
      await this.port.cancel({
        identity: request.identity,
        requestId: request.requestId,
      });
      throw new PublicationFailure('invalid-response');
    }
    return result;
  }
  async cancel(): Promise<void> {
    const request = this.latest;
    this.latest = null;
    if (request)
      await this.port.cancel({
        identity: request.identity,
        requestId: request.requestId,
      });
  }
  async close(): Promise<void> {
    this.closed = true;
    await this.cancel();
  }
}

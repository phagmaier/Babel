import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as assessment from '../../src/domain/exportAssessment';
import { parseFountain } from '../../src/domain/fountainCodec';
import { rendererReading } from '../../src/domain/rendererReading';

// AUDIT-READING-CANDIDATES. Joins Babel's reading of each hand-written sample
// with what the pinned helper really prints for the same bytes. The matrix's
// expectations are literal and were committed before the first render.
interface Sample {
  readonly id: string;
  readonly class: 'candidate' | 'control' | 'scope';
  readonly occurrences: readonly number[];
  readonly note: string;
  readonly source: string;
  readonly visible: readonly string[];
  readonly hidden: readonly string[];
  readonly italic: readonly string[];
  readonly upright: readonly string[];
}
interface Rendered {
  readonly id: string;
  readonly exit: number;
  readonly receipt: {
    readonly pageCount?: number;
    readonly sourceSha256?: string;
    readonly warnings?: readonly { readonly code: string }[];
  } | null;
  readonly parser: unknown;
  readonly text: string;
  readonly lines: readonly {
    readonly page: number;
    readonly left: number;
    readonly italic: boolean;
    readonly bold: boolean;
    readonly text: string;
  }[];
  readonly fonts: readonly string[];
}

const root = process.env.BABEL_READING_ROOT;
if (!root)
  throw new Error('Set BABEL_READING_ROOT to a fresh, existing directory.');
const matrix = JSON.parse(
  readFileSync('tests/investigation/reading-candidates.json', 'utf8'),
) as { samples: Sample[] };
const rendered = JSON.parse(
  execFileSync('python3', ['tools/investigation/render_samples.py', root], {
    input: JSON.stringify(
      matrix.samples.map(({ id, source }) => ({ id, source })),
    ),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 150000,
  }),
) as { runtime: string; samples: Rendered[] };

const facts = matrix.samples.map((sample, index) => {
  const bytes = new TextEncoder().encode(sample.source);
  const document = parseFountain(bytes);
  const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
  // None of these samples has a dialogue group or numbered heading, so the
  // native layout probe has nothing to answer; anything else stays unverified.
  const probes = assessment.assessmentLayoutProbes(document).length;
  const check = assessment.evaluateExportAssessment(document, {
    identity: assessment.PUBLICATION_ASSESSMENT_IDENTITY,
    version: 1,
    sourceSha256,
    layout: probes ? undefined : [],
  });
  const reading = rendererReading(
    assessment.assessmentView(document).document.lines,
  );
  const verified = check.status === 'verified' ? check : null;
  const pdf = rendered.samples[index]!;
  return {
    ...sample,
    sourceSha256,
    codec: {
      lines: document.lines.map((line) => [line.kind, line.text]),
      titleFields: document.titleFields.map((field) => field.key),
    },
    assessment: {
      status: check.status,
      clean:
        !!verified &&
        !verified.issues.some((issue) => issue.severity === 'blocking'),
      layout: verified?.layout ?? null,
      layoutProbes: probes,
      issues: (verified?.issues ?? []).map((issue) => ({
        code: issue.code,
        line: issue.line,
        endLine: issue.endLine,
        message: issue.message,
      })),
      omissions: verified
        ? assessment.describeOmissions(verified.omissions)
        : null,
    },
    mirror: {
      title: reading.title && {
        length: reading.title.length,
        keys: [...reading.title.keys],
      },
      paragraphs: reading.paragraphs.map((p) => [p.kind, p.roles, p.texts]),
    },
    pdf,
  };
});
writeFileSync(
  resolve(root, 'classification.json'),
  JSON.stringify({ runtime: rendered.runtime, samples: facts }, null, 2),
  { flag: 'wx' },
);

describe.each(facts)('$id ($class)', (sample) => {
  it('renders the bytes the assessment read', () => {
    expect(sample.pdf.id).toBe(sample.id);
    expect(sample.pdf.exit).toBe(0);
    expect(sample.pdf.receipt?.sourceSha256).toBe(sample.sourceSha256);
  });

  it('prints what the script shows whenever the assessment is clean', () => {
    if (!sample.assessment.clean) {
      // Reported: the author is asked to decide before export.
      expect(sample.assessment.issues.length).toBeGreaterThan(0);
      return;
    }
    const { text, lines } = sample.pdf;
    const italic = (wanted: string) =>
      lines.some((line) => line.italic && line.text.includes(wanted));
    expect({
      missing: sample.visible.filter(
        (wanted) => !text.includes(wanted.split(/\s+/).join(' ')),
      ),
      leaked: sample.hidden.filter((unwanted) => text.includes(unwanted)),
      notItalic: sample.italic.filter((wanted) => !italic(wanted)),
      notUpright: sample.upright.filter(italic),
    }).toEqual({ missing: [], leaked: [], notItalic: [], notUpright: [] });
  });
});

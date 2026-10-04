import {
  assessmentView,
  evaluateExportAssessment,
  type AssessmentContext,
  type ExportAssessment,
} from './exportAssessment';
export type { ExportAssessment } from './exportAssessment';
import type { FountainDocument } from './fountainModel';

export type CheckCode =
  'SC001' | 'SC002' | 'SC003' | 'SC004' | 'SC005' | 'SC008' | 'SC006' | 'SC007';
export type CheckSeverity = 'blocking' | 'warning' | 'advisory';
export interface CheckIssue {
  readonly code: CheckCode;
  readonly severity: CheckSeverity;
  /** Stable identity for dismissal and rendering; unique per evaluation. */
  readonly key: string;
  readonly message: string;
  readonly explanation: string;
  /** Physical document line; null only for document-level findings. */
  readonly line: number | null;
  readonly endLine: number;
  /** Source byte targets for publication limitations. */
  readonly sourceStart?: number;
  readonly sourceEnd?: number;
  /** No automatic fixes are offered. */
  readonly hasFix: false;
}
export interface CheckReport {
  readonly issues: readonly CheckIssue[];
  readonly truncated: boolean;
  /** SC005/SC008 require matching verified profile/font and layout identities. */
  readonly exportAssessment: ExportAssessment;
}

/** Hard bound on reported issues; evaluation order is document order. */
export const MAX_CHECK_ISSUES = 1000;

const explanations: Record<CheckCode, string> = {
  SC005: 'The selected publication profile cannot represent this content.',
  SC008: 'The pinned fonts or shaping policy cannot render this text.',
  SC001:
    'A nonempty character cue has no spoken dialogue attached. The text is preserved and saving stays available; add dialogue or leave the cue while drafting.',
  SC002:
    'A parenthetical stands outside a speech group or its group has no dialogue. The text is preserved; attach it to a cue with dialogue or leave it while drafting.',
  SC003:
    'A dual-dialogue relationship is incomplete, broken or ambiguous. Both speakers are preserved; review the pairing before publication.',
  SC004:
    'An incomplete or unbalanced construct is preserved verbatim as raw text and needs review. Nothing was normalized or removed.',
  SC006:
    'A scene number appears more than once. Numbers are advisory unless a chosen workflow requires uniqueness.',
  SC007:
    'Three or more consecutive blank lines may be unintended spacing. Single and double blanks are never flagged.',
};

function issue(
  code: CheckCode,
  severity: CheckSeverity,
  message: string,
  line: number | null,
  endLine: number,
): CheckIssue {
  return Object.freeze({
    code,
    severity,
    key: `${code}:${line ?? ''}:${endLine}:${message}`,
    message,
    explanation: explanations[code],
    line,
    endLine,
    hasFix: false,
  });
}

/**
 * Pure evaluation over one immutable snapshot. Reads structure and codec
 * diagnostics; never parses, edits, hashes, writes or fetches anything.
 * Blank lines, empty cues and unfinished drafting are not issues.
 */
export function evaluateScriptCheck(
  source: FountainDocument,
  context?: AssessmentContext,
): CheckReport {
  // Structure is judged as the renderer reads it: a closed inline note beside
  // visible text does not turn a speech into raw text. Line indexes are shared.
  const document = assessmentView(source).document;
  const issues: CheckIssue[] = [];
  const push = (found: CheckIssue) => {
    if (issues.length < MAX_CHECK_ISSUES) issues.push(found);
  };
  const groups = document.dialogueGroups;
  const byCue = new Map(groups.map((group) => [group.cueLine, group]));
  const groupIds = new Set(groups.map((group) => group.id));
  const byId = new Map(document.lines.map((row) => [row.id, row]));
  const spoken = (lineIds: readonly string[]) =>
    lineIds.some(
      (id) =>
        byId.get(id)?.kind === 'dialogue' &&
        (byId.get(id)?.text.trim() ?? '') !== '',
    );
  const sc002Lines = new Set<number>();
  const rawRuns = new Set<number>();

  for (const [index, line] of document.lines.entries()) {
    if (line.kind === 'character' && line.text.trim() !== '') {
      const group = byCue.get(index);
      if (!group || !spoken(group.lineIds))
        push(
          issue(
            'SC001',
            'warning',
            `Cue “${line.text.trim()}” has no dialogue.`,
            index,
            index,
          ),
        );
    }
    if (line.kind === 'parenthetical') {
      const group = line.speechOf
        ? groups.find((candidate) => candidate.id === line.speechOf)
        : undefined;
      if (!group || !spoken(group.lineIds)) {
        sc002Lines.add(index);
        push(
          issue(
            'SC002',
            'warning',
            line.speechOf
              ? 'Parenthetical speech has no dialogue.'
              : 'Parenthetical stands outside a speech group.',
            index,
            index,
          ),
        );
      }
    }
  }

  // Contiguous raw rows form one reviewable finding, not one per line.
  for (let index = 0; index < document.lines.length;) {
    if (document.lines[index]!.kind !== 'raw') {
      index++;
      continue;
    }
    let end = index;
    while (document.lines[end + 1]?.kind === 'raw') end++;
    for (let row = index; row <= end; row++) rawRuns.add(row);
    push(
      issue(
        'SC004',
        'warning',
        end === index
          ? `Raw source at line ${index + 1} needs review.`
          : `Raw source at lines ${index + 1}–${end + 1} needs review.`,
        index,
        end,
      ),
    );
    index = end + 1;
  }

  for (const diagnostic of document.diagnostics) {
    const line = diagnostic.line ?? null;
    if (line !== null && (line < 0 || line >= document.lines.length)) continue;
    switch (diagnostic.code) {
      case 'unpaired-dual':
      case 'ambiguous-dual':
        push(issue('SC003', 'warning', diagnostic.message, line, line ?? 0));
        break;
      case 'malformed-parenthetical':
        if (line !== null && !sc002Lines.has(line)) {
          sc002Lines.add(line);
          push(issue('SC002', 'warning', diagnostic.message, line, line));
        }
        break;
      case 'unclosed-region':
      case 'unsupported-region':
      case 'ambiguous-region':
      case 'inline-incomplete':
        if (line === null || !rawRuns.has(line))
          push(issue('SC004', 'warning', diagnostic.message, line, line ?? 0));
        break;
      case 'invalid-utf8':
        push(
          issue(
            'SC004',
            'warning',
            'Unreadable bytes are preserved verbatim; review the original source outside the editor.',
            null,
            0,
          ),
        );
        break;
      default:
        break;
    }
  }

  for (const group of groups) {
    if (group.dualWith && !groupIds.has(group.dualWith))
      push(
        issue(
          'SC003',
          'warning',
          'Dual dialogue references a missing partner group.',
          group.cueLine,
          group.cueLine,
        ),
      );
  }

  const seen = new Map<string, number[]>();
  for (const [index, line] of document.lines.entries()) {
    if (line.kind === 'sceneHeading' && line.sceneNumber) {
      const rows = seen.get(line.sceneNumber) ?? [];
      rows.push(index);
      seen.set(line.sceneNumber, rows);
    }
  }
  for (const [number, rows] of seen) {
    if (rows.length > 1)
      push(
        issue(
          'SC006',
          'advisory',
          `Scene number ${number} appears ${rows.length} times.`,
          rows[0]!,
          rows[0]!,
        ),
      );
  }

  for (let index = 0; index < document.lines.length;) {
    if (document.lines[index]!.kind !== 'blank') {
      index++;
      continue;
    }
    let end = index;
    while (document.lines[end + 1]?.kind === 'blank') end++;
    if (end - index + 1 >= 3)
      push(
        issue(
          'SC007',
          'advisory',
          `Lines ${index + 1}–${end + 1} hold ${end - index + 1} consecutive blanks.`,
          index,
          end,
        ),
      );
    index = end + 1;
  }

  const exportAssessment = evaluateExportAssessment(source, context);
  const blocking =
    exportAssessment.status === 'verified' ? exportAssessment.issues : [];
  // Structural findings cannot consume the entire display budget and hide
  // known export blockers. Within each class the existing order is retained.
  const displayed = [
    ...issues.slice(0, MAX_CHECK_ISSUES - blocking.length),
    ...blocking,
  ];
  return Object.freeze({
    issues: Object.freeze(displayed),
    truncated: issues.length + blocking.length >= MAX_CHECK_ISSUES,
    exportAssessment,
  });
}

/** Export stops for review only when something needs an informed decision. */
export function requiresExportReview(report: CheckReport): boolean {
  return report.issues.some((issue) => issue.severity !== 'advisory');
}

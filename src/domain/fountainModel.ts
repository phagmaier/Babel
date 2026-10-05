/** Immutable source snapshots. IDs and draft intent are session/recovery data only. */
export type FountainKind =
  | 'blank'
  | 'title'
  | 'titleContinuation'
  | 'sceneHeading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'lyrics'
  | 'centered'
  | 'section'
  | 'synopsis'
  | 'note'
  | 'boneyard'
  | 'pageBreak'
  | 'raw';

export type EditableKind = Exclude<
  FountainKind,
  'title' | 'titleContinuation' | 'note' | 'boneyard' | 'raw'
>;
export type Newline = '' | '\n' | '\r' | '\r\n';
export type DraftKind =
  | 'sceneHeading'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  // AUDIT-PARK-H-F4-04: a typed Transition Fountain reads as Action keeps
  // its element in recovery only. Additive; the recovery schema is versioned
  // separately and unchanged.
  | 'transition';

export interface FountainLine {
  readonly id: string;
  readonly kind: FountainKind;
  /** Authored content, with element markers extracted but inline syntax retained. */
  readonly text: string;
  readonly sourceText: string;
  /** UTF-8 byte offsets; sourceEnd includes the original line ending. */
  readonly sourceStart: number;
  readonly contentEnd: number;
  readonly sourceEnd: number;
  readonly newline: Newline;
  readonly editable: boolean;
  readonly marker?: string;
  readonly titleKey?: string;
  readonly sectionLevel?: number;
  readonly sceneNumber?: string;
  readonly characterName?: string;
  readonly characterExtension?: string;
  readonly speechOf?: string;
  /** Physical cue line index; the document also exposes group relationships by cue ID. */
  readonly dualWith?: number;
  readonly dualMarker?: boolean;
  readonly actionSubtype?: 'shot';
  readonly intendedKind?: DraftKind;
  readonly inline?: InlineContent;
  readonly titleOf?: string;
  readonly hiddenOf?: string;
  /** Classification is not permission to remove any authored blank bytes. */
  readonly blankRole?: 'source' | 'draft';
}

export interface CodecDiagnostic {
  readonly code:
    | 'invalid-utf8'
    | 'unsupported-region'
    | 'incomplete-cue'
    | 'unpaired-dual'
    | 'malformed-parenthetical'
    | 'unclosed-region'
    | 'draft-intent'
    | 'recovery-mismatch'
    | 'inline-incomplete'
    | 'ambiguous-region'
    | 'ambiguous-dual';
  readonly line?: number;
  readonly message: string;
}

export interface RecoveryLine {
  readonly id: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly sourceText: string;
  readonly newline: Newline;
  readonly intendedKind?: DraftKind;
  readonly actionSubtype?: 'shot';
}

/** Apply only to an exact source inventory; mismatched metadata is diagnosed/ignored. */
export interface FountainRecovery {
  readonly schema: 1;
  readonly bom: boolean;
  /** Allocation high-water mark prevents reusing deleted session IDs. */
  readonly nextId: number;
  readonly lines: readonly RecoveryLine[];
}

export interface FountainDocument {
  /** Each access returns an owned copy; typed arrays cannot be frozen safely. */
  readonly bytes: Uint8Array;
  readonly lines: readonly FountainLine[];
  readonly bom: boolean;
  readonly diagnostics: readonly CodecDiagnostic[];
  readonly readOnlyReason?: string;
  readonly recovery: FountainRecovery;
  readonly titleFields: readonly TitleField[];
  readonly hiddenRegions: readonly HiddenRegion[];
  readonly dialogueGroups: readonly DialogueGroup[];
  readonly sourceBreaks: readonly SourceBreak[];
}

/** A complete intended replacement of one physical source line. No newline characters. */
export interface LineEdit {
  readonly kind: EditableKind;
  readonly text: string;
  /** Omission retains a scene number only when the original is a heading; null removes it. */
  readonly sceneNumber?: string | null;
  readonly sectionLevel?: number;
  readonly actionSubtype?: 'shot' | null;
  readonly dualWith?: string | null;
}

export type InlineStyle = 'bold' | 'italic' | 'underline';
export interface StyledText {
  readonly text: string;
  readonly styles: readonly InlineStyle[];
}
export interface InlineRun extends StyledText {
  /** UTF-16 offsets into the line's extracted Fountain text, including escapes. */
  readonly start: number;
  readonly end: number;
}
export interface InlineDelimiter {
  readonly marker: string;
  readonly start: number;
  readonly end: number;
  readonly closingStart: number;
  readonly closingEnd: number;
}
export interface InlineContent {
  readonly text: string;
  readonly runs: readonly InlineRun[];
  readonly delimiters: readonly InlineDelimiter[];
  /** Unmatched/crossing syntax is retained literally; rich editing requires a representable result. */
  readonly complete: boolean;
}
export interface TitleField {
  readonly id: string;
  readonly key: string;
  readonly unknown: boolean;
  readonly from: number;
  readonly count: number;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly values: readonly {
    readonly lineId: string;
    readonly text: string;
    readonly inline: InlineContent;
  }[];
}
export interface HiddenRegion {
  readonly id: string;
  readonly kind: 'note' | 'boneyard';
  readonly from: number;
  readonly count: number;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly contentStart: number;
  readonly contentEnd: number;
  readonly content: string;
  readonly closed: boolean;
  readonly ambiguous: boolean;
}
export interface DialogueGroup {
  readonly id: string;
  readonly cueLine: number;
  readonly from: number;
  readonly count: number;
  readonly lineIds: readonly string[];
  readonly dualWith?: string;
  readonly complete: boolean;
}
export interface SourceBreak {
  readonly fromId: string;
  readonly toId: string;
  readonly kind: 'action' | 'dialogue';
  readonly newline: Newline;
  readonly sourceStart: number;
  readonly sourceEnd: number;
}

/** Exact concrete syntax plus independently requested extracted meaning for a declared context. */
export interface SourceLineEdit {
  readonly source: string;
  readonly kind: FountainKind;
  readonly text: string;
  readonly titleKey?: string;
  readonly sceneNumber?: string;
  readonly sectionLevel?: number;
  /** A cue ID, or null for explicitly absent dual association. */
  readonly dualWith?: string | null;
}

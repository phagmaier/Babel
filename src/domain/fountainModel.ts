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
export type DraftKind = 'character' | 'dialogue' | 'parenthetical';

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
  /** Physical cue line index. Complex group transformations remain M3-03. */
  readonly dualWith?: number;
  readonly dualMarker?: boolean;
  readonly actionSubtype?: 'shot';
  readonly intendedKind?: DraftKind;
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
    | 'recovery-mismatch';
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
}

/** A complete intended replacement of one physical source line. No newline characters. */
export interface LineEdit {
  readonly kind: EditableKind;
  readonly text: string;
  /** Omission retains a scene number only when the original is a heading; null removes it. */
  readonly sceneNumber?: string | null;
  readonly sectionLevel?: number;
  readonly actionSubtype?: 'shot' | null;
}

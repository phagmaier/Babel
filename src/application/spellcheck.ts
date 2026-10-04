import { stampOf, isCurrent } from '../editor/state';
import type { EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { cueName } from '../domain/completion';
import { correctSpelling, highlightSpelling } from '../editor/spellcheck';
import { dispatchIsolated } from '../editor/formatting';

export interface SpellcheckReply {
  enabled: boolean;
  language: string;
  languages: string[];
  available: boolean;
  needsAttention: boolean;
  addedCount: number;
  ignoredCount: number;
  resource: string;
  correct: boolean[];
  suggestions: string[];
}
export interface SpellcheckRequest {
  action: 'status' | 'configure' | 'check' | 'suggest' | 'ignore' | 'add';
  language?: string;
  enabled?: boolean;
  words?: string[];
}
export interface SpellcheckPort {
  request(request: SpellcheckRequest): Promise<SpellcheckReply>;
}
export const unavailableSpellcheck: SpellcheckPort = {
  request: async () => {
    throw new Error('spellcheckUnavailable');
  },
};
export interface SpellingWord {
  readonly word: string;
  readonly row: number;
  readonly from: number;
  readonly to: number;
}
export interface SpellingScan {
  readonly doc: EditorState['doc'];
  readonly session: object;
  readonly version: number;
  readonly words: readonly SpellingWord[];
  readonly omitted: number;
  readonly limited: boolean;
}
export const MAX_SPELLING_WORDS = 32768;
export const MAX_SPELLING_ISSUES = 200;
const wordPattern = /\p{L}[\p{L}\p{M}\p{N}]*(?:['’-][\p{L}\p{M}\p{N}]+)*/gu;
export function validSpellingWord(word: string) {
  return (
    new TextEncoder().encode(word).length <= 128 &&
    /^[\p{L}\p{N}\u0300-\u036f'’-]+$/u.test(word) &&
    /^\p{L}[\p{L}\p{M}\p{N}]*(?:['’-][\p{L}\p{M}\p{N}]+)*$/u.test(word)
  );
}
/** Deferred explicit scan, never a typing-path source parse or persistent vocabulary. */
export function spellingScan(state: EditorState): SpellingScan {
  const names = new Set<string>();
  state.doc.forEach((node) => {
    if (node.type.name === 'character' && !node.attrs.protected)
      for (const m of cueName(node.textContent).name.matchAll(wordPattern))
        names.add(m[0].toLowerCase());
  });
  const words: SpellingWord[] = [];
  let omitted = 0,
    limited = false;
  state.doc.forEach((node, position, row) => {
    if (
      node.attrs.protected ||
      ['note', 'boneyard', 'raw', 'title', 'titleContinuation'].includes(
        node.type.name,
      )
    )
      return;
    for (const m of node.textContent.matchAll(wordPattern)) {
      if (words.length >= MAX_SPELLING_WORDS) {
        limited = true;
        break;
      }
      if (names.has(m[0].toLowerCase())) continue;
      if (!validSpellingWord(m[0])) {
        omitted++;
        continue;
      }
      words.push(
        Object.freeze({
          word: m[0],
          row,
          from: position + 1 + m.index,
          to: position + 1 + m.index + m[0].length,
        }),
      );
    }
  });
  return Object.freeze({
    ...stampOf(state),
    words: Object.freeze(words),
    omitted,
    limited,
  });
}
export function spellingCurrent(view: EditorView, scan: SpellingScan) {
  return !view.isDestroyed && isCurrent(view.state, scan);
}
export interface SpellcheckState {
  status: SpellcheckReply | null;
  busy: boolean;
  message: string;
  scan: SpellingScan | null;
  issues: readonly SpellingWord[];
  active: SpellingWord | null;
  suggestions: readonly string[];
}
const failureMessage = (action: string) =>
  action === 'add' || action === 'configure'
    ? 'Dictionary preferences or Add could not be confirmed. Prior valid settings and words are retained; check again after fixing local dictionary storage. Writing and saving remain available.'
    : 'Offline spelling is unavailable. Check installed language resources and local dictionary storage, then retry. Writing and saving remain available.';
export class SpellcheckController {
  state: SpellcheckState = {
    status: null,
    busy: false,
    message: 'Loading offline dictionaries…',
    scan: null,
    issues: [],
    active: null,
    suggestions: [],
  };
  private sequence = 0;
  private live = true;
  private working = false;
  constructor(
    private readonly port: SpellcheckPort,
    private readonly view: () => EditorView | null,
    private readonly blocked: () => boolean,
    private readonly changed: (state: SpellcheckState) => void,
    private readonly readOnly: () => boolean = () => false,
  ) {}
  private update(patch: Partial<SpellcheckState>) {
    if (!this.live) return;
    this.state = { ...this.state, ...patch };
    this.changed(this.state);
  }
  invalidate() {
    this.sequence++;
    const view = this.view();
    if (view) highlightSpelling(view, null, []);
    if (this.state.scan)
      this.update({
        scan: null,
        issues: [],
        active: null,
        suggestions: [],
        message:
          'Spelling results are stale. Check spelling again for the current version.',
      });
  }
  private async operation(
    action: string,
    run: (sequence: number) => Promise<void>,
  ) {
    if (
      !this.live ||
      this.working ||
      (action !== 'status' && (this.blocked() || this.view()?.composing))
    )
      return;
    this.working = true;
    const sequence = ++this.sequence;
    this.update({ busy: true });
    try {
      await run(sequence);
    } catch {
      if (this.live && sequence === this.sequence)
        this.update({ message: failureMessage(action) });
    } finally {
      this.working = false;
      this.update({ busy: false });
    }
  }
  async load() {
    this.invalidate();
    await this.operation('status', async () => {
      const status = await this.port.request({ action: 'status' });
      this.update({
        status,
        message: status.needsAttention
          ? 'Local dictionary needs attention. Prior valid vocabulary is available; Add and preferences are blocked.'
          : !status.available
            ? `No offline dictionary for ${status.language}. Select an installed language, or keep writing without spelling.`
            : !status.enabled
              ? 'Spellcheck is Off.'
              : 'Ready. Check spelling explicitly; edits invalidate results.',
      });
    });
  }
  async configure(language: string, enabled: boolean) {
    await this.operation('configure', async () => {
      const status = await this.port.request({
        action: 'configure',
        language,
        enabled,
      });
      this.invalidate();
      this.update({
        status,
        message: !enabled
          ? 'Spellcheck is Off.'
          : !status.available
            ? `No offline dictionary for ${language}. Writing remains available.`
            : 'Spelling preferences saved locally. Check spelling again.',
      });
    });
  }
  async check() {
    await this.operation('check', async (sequence) => {
      const status = this.state.status,
        view = this.view();
      if (!status?.enabled || !status.available || !view) return;
      const scan = spellingScan(view.state);
      const unique = [...new Set(scan.words.map((w) => w.word))];
      const wrong = new Set<string>();
      for (let at = 0; at < unique.length; at += 128) {
        if (
          sequence !== this.sequence ||
          !this.live ||
          !spellingCurrent(view, scan) ||
          this.blocked() ||
          view.composing
        )
          return;
        const words = unique.slice(at, at + 128);
        const reply = await this.port.request({
          action: 'check',
          language: status.language,
          words,
        });
        if (
          reply.language !== status.language ||
          reply.correct.length !== words.length ||
          reply.correct.some((value) => typeof value !== 'boolean')
        )
          throw new Error('Invalid spelling reply');
        reply.correct.forEach((correct, index) => {
          if (!correct) wrong.add(words[index]!);
        });
      }
      if (
        sequence !== this.sequence ||
        !this.live ||
        !spellingCurrent(view, scan) ||
        this.blocked() ||
        view.composing
      )
        return;
      const all = scan.words.filter((w) => wrong.has(w.word));
      const issues = all.slice(0, MAX_SPELLING_ISSUES);
      highlightSpelling(view, scan, issues);
      this.update({
        scan,
        issues,
        active: null,
        suggestions: [],
        message: `${all.length} possible spelling issues in ${scan.words.length} checked words.${all.length > issues.length ? ' Showing first 200 issues.' : ''}${scan.limited ? ' Scan limited to first 32768 words.' : ''}${scan.omitted ? ` ${scan.omitted} unsupported or oversized words skipped.` : ''} Names from editable Character cues are skipped. Title, notes, omitted and raw regions are excluded.`,
      });
    });
  }
  async choose(word: SpellingWord) {
    await this.operation('suggest', async (sequence) => {
      const { status, scan, issues } = this.state,
        view = this.view();
      if (
        !status ||
        !scan ||
        !view ||
        !issues.includes(word) ||
        !spellingCurrent(view, scan)
      )
        return;
      this.update({ active: word, suggestions: [] });
      const reply = await this.port.request({
        action: 'suggest',
        language: status.language,
        words: [word.word],
      });
      if (
        sequence !== this.sequence ||
        !spellingCurrent(view, scan) ||
        this.blocked() ||
        view.composing
      )
        return;
      if (
        reply.language !== status.language ||
        reply.suggestions.length > 8 ||
        reply.suggestions.some((w) => !validSpellingWord(w))
      )
        throw new Error('Invalid spelling reply');
      this.update({
        suggestions: reply.suggestions,
        message: reply.suggestions.length
          ? `Choose a correction for “${word.word}”, or Ignore/Add locally.`
          : `No single-word suggestions for “${word.word}”. Ignore/Add are available.`,
      });
    });
  }
  correct(suggestion: string) {
    const { active, scan, suggestions } = this.state,
      view = this.view();
    if (
      !view ||
      !active ||
      !scan ||
      !suggestions.includes(suggestion) ||
      this.working ||
      this.readOnly() ||
      this.blocked() ||
      view.composing
    )
      return false;
    try {
      const tr = correctSpelling(view.state, scan, active, suggestion);
      dispatchIsolated(view, tr);
      view.focus();
      this.invalidate();
      this.update({
        message:
          'Correction applied in one step. Undo restores text, marks and previous selection.',
      });
      return true;
    } catch (failure) {
      this.update({
        message:
          failure instanceof Error
            ? failure.message
            : 'Correction refused; source retained.',
      });
      return false;
    }
  }
  async vocabulary(action: 'ignore' | 'add') {
    await this.operation(action, async (sequence) => {
      const { active, scan, status } = this.state,
        view = this.view();
      if (!active || !scan || !status || !view || !spellingCurrent(view, scan))
        return;
      const reply = await this.port.request({
        action,
        language: status.language,
        words: [active.word],
      });
      if (!this.live) return;
      this.update({ status: reply });
      if (sequence !== this.sequence || !spellingCurrent(view, scan)) return;
      const issues = this.state.issues.filter(
        (w) => w.word.toLowerCase() !== active.word.toLowerCase(),
      );
      highlightSpelling(view, scan, issues);
      this.update({
        issues,
        active: null,
        suggestions: [],
        message:
          action === 'ignore'
            ? 'Ignored for this application session and language. Restart clears Ignore.'
            : 'Added to this application’s local dictionary for this language. Confirmed durable storage; manuscript unchanged.',
      });
    });
  }
  dispose() {
    this.invalidate();
    this.live = false;
  }
}

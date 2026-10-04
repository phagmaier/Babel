import { stampOf, isCurrent, editorOrigin, editorVersion } from './state';
import { closeHistory } from 'prosemirror-history';
import {
  TextSelection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import {
  buildLocalVocabulary,
  commonTimes,
  cueName,
  headingPrefixes,
  headingSegments,
  rankVocabulary,
  withBuiltins,
  type LocalVocabulary,
} from '../domain/completion';

export interface CompletionIndex {
  readonly doc: EditorState['doc'];
  readonly session: object;
  readonly version: number;
  readonly vocabulary: LocalVocabulary;
}
export interface CompletionOffer {
  readonly session: object;
  readonly version: number;
  readonly caret: number;
  readonly from: number;
  readonly to: number;
  readonly segment: 'character' | 'prefix' | 'location' | 'time';
  readonly items: readonly string[];
}
export function indexEditorCompletion(
  state: EditorState,
  recent: ReadonlyMap<string, number> = new Map(),
): CompletionIndex {
  return Object.freeze({
    ...stampOf(state),
    vocabulary: buildLocalVocabulary(
      state.doc.content.content.map((node) => ({
        kind: node.type.name,
        text: node.textContent,
        protected: node.attrs.protected,
        hidden: !!node.attrs.hiddenOf,
        recent: recent.get(node.attrs.id as string),
      })),
    ),
  });
}
const issuedOffers = new WeakMap<CompletionOffer, CompletionIndex>();
export function offerEditorCompletion(
  state: EditorState,
  index: CompletionIndex,
): CompletionOffer | null {
  const { $from, empty, from } = state.selection;
  if (
    !empty ||
    !$from.depth ||
    !isCurrent(state, index) ||
    editorOrigin(state).document.readOnlyReason
  )
    return null;
  const node = $from.parent;
  if (node.attrs.protected || node.attrs.hiddenOf) return null;
  const text = node.textContent;
  const offset = $from.parentOffset;
  let start = 0,
    end = text.length;
  let segment: CompletionOffer['segment'];
  let entries;
  if (node.type.name === 'character') {
    segment = 'character';
    end = cueName(text).end;
    if (offset > end) return null;
    entries = index.vocabulary.characters;
  } else if (node.type.name === 'sceneHeading') {
    const parts = headingSegments(text);
    if (parts.prefixEnd && offset <= parts.prefixEnd) {
      segment = 'prefix';
      end = parts.prefixEnd;
      entries = withBuiltins([], headingPrefixes);
    } else if (
      !parts.prefixEnd &&
      offset === text.length &&
      /^[A-Za-z./]*$/.test(text) &&
      headingPrefixes.some((prefix) =>
        prefix.toLowerCase().startsWith(text.toLowerCase()),
      )
    ) {
      segment = 'prefix';
      entries = withBuiltins([], headingPrefixes);
    } else if (parts.timeStart !== null && offset >= parts.timeStart) {
      segment = 'time';
      start = parts.timeStart;
      entries = index.vocabulary.times;
    } else {
      segment = 'location';
      start = parts.locationStart;
      end = parts.locationEnd;
      if (offset < start || offset > end) return null;
      entries = index.vocabulary.locations;
    }
  } else return null;
  // Complete an entire segment only at its end; never overwrite a suffix while typing mid-name.
  if (offset !== end) return null;
  // The row currently being written is not evidence for suggesting itself.
  // Established exact matches still rank first when present elsewhere.
  const active =
    segment === 'character'
      ? cueName(text).name.trim()
      : text.slice(start, end).trim();
  if (segment !== 'prefix')
    entries = entries.flatMap((entry) =>
      entry.text !== active
        ? [entry]
        : entry.frequency > 1
          ? [{ ...entry, frequency: entry.frequency - 1 }]
          : entry.frequency === 0
            ? [entry]
            : [],
    );
  if (segment === 'time') entries = withBuiltins(entries, commonTimes);
  const items = rankVocabulary(entries, text.slice(start, offset));
  if (!items.length) return null;
  const offer = Object.freeze({
    session: index.session,
    version: index.version,
    caret: from,
    from: $from.start() + start,
    to: $from.start() + end,
    segment,
    items,
  });
  issuedOffers.set(offer, index);
  return offer;
}
export function acceptEditorCompletion(
  state: EditorState,
  offer: CompletionOffer,
  selected: number,
): Transaction | null {
  if (
    !issuedOffers.has(offer) ||
    offer.session !== editorOrigin(state).session ||
    offer.version !== editorVersion(state) ||
    !state.selection.empty ||
    state.selection.from !== offer.caret
  )
    return null;
  const value = offer.items[selected];
  if (value === undefined) return null;
  // A trusted immutable offer is bound to the exact document and version.
  // Acceptance validates only the active row; it never rebuilds/ranks the index on a key.
  const node = state.selection.$from.parent;
  if (
    issuedOffers.get(offer)!.doc !== state.doc ||
    node.attrs.protected ||
    node.attrs.hiddenOf ||
    node.type.name !==
      (offer.segment === 'character' ? 'character' : 'sceneHeading') ||
    offer.from < state.selection.$from.start() ||
    offer.to > state.selection.$from.end()
  )
    return null;
  const suffix =
    offer.segment === 'prefix' && offer.to === state.selection.$from.end()
      ? ' '
      : '';
  const tr = closeHistory(state.tr).insertText(
    value + suffix,
    offer.from,
    offer.to,
  );
  return tr.setSelection(
    TextSelection.create(tr.doc, offer.from + value.length + suffix.length),
  );
}

/** Derived data and popup state only. Work is deferred; never a second live manuscript. */
export class LocalCompletion {
  offer: CompletionOffer | null = null;
  selected = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private view: EditorView | undefined;
  private suspended = false;
  private dismissedVersion = -1;
  private clock = 0;
  private session: object | undefined;
  private recent = new Map<string, number>();
  private priorDoc: EditorState['doc'] | undefined;
  constructor(
    private readonly render: (completion: LocalCompletion) => void = () => {},
  ) {}
  changed(view: EditorView) {
    this.view = view;
    clearTimeout(this.timer);
    this.offer = null;
    this.render(this);
    const state = view.state;
    if (this.session !== editorOrigin(state).session) {
      this.session = editorOrigin(state).session;
      this.recent.clear();
      this.priorDoc = undefined;
      this.dismissedVersion = -1;
    }
    if (
      this.suspended ||
      view.composing ||
      this.dismissedVersion === editorVersion(state)
    )
      return;
    this.timer = setTimeout(() => {
      if (
        this.view !== view ||
        view.isDestroyed ||
        view.state !== state ||
        this.suspended ||
        view.composing ||
        !view.hasFocus()
      )
        return;
      if (this.priorDoc !== state.doc) {
        const previous = new Map(
          this.priorDoc?.content.content.map((node) => [node.attrs.id, node]) ??
            [],
        );
        for (const node of state.doc.content.content) {
          if (
            previous.get(node.attrs.id) !== node &&
            ['character', 'sceneHeading'].includes(node.type.name)
          )
            this.recent.set(node.attrs.id as string, ++this.clock);
        }
        this.priorDoc = state.doc;
      }
      this.offer = offerEditorCompletion(
        state,
        indexEditorCompletion(state, this.recent),
      );
      this.selected = 0;
      this.render(this);
    }, 0);
  }
  suspend() {
    this.suspended = true;
    this.dismiss();
  }
  resume(view: EditorView) {
    this.suspended = false;
    this.changed(view);
  }
  dismiss() {
    clearTimeout(this.timer);
    if (this.view) this.dismissedVersion = editorVersion(this.view.state);
    this.offer = null;
    this.render(this);
  }
  accept(selected = this.selected, expectedOffer = this.offer) {
    const view = this.view;
    const offer = this.offer;
    if (
      !view ||
      !offer ||
      offer !== expectedOffer ||
      this.suspended ||
      view.composing
    )
      return false;
    const tr = acceptEditorCompletion(view.state, offer, selected);
    this.dismiss();
    if (!tr) return false;
    view.dispatch(tr);
    // Isolate completion from immediately following native typing as well as preceding typing.
    view.dispatch(closeHistory(view.state.tr).setMeta('addToHistory', false));
    this.dismiss();
    view.focus();
    return true;
  }
  key(view: EditorView, event: KeyboardEvent) {
    if (
      !this.offer ||
      this.suspended ||
      view.composing ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey
    )
      return false;
    if (
      this.offer.session !== editorOrigin(view.state).session ||
      this.offer.version !== editorVersion(view.state)
    ) {
      this.dismiss();
      return false;
    }
    if (event.key === 'Escape') {
      this.dismiss();
      return true;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      this.selected =
        (this.selected +
          (event.key === 'ArrowDown' ? 1 : -1) +
          this.offer.items.length) %
        this.offer.items.length;
      this.render(this);
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') return this.accept();
    return false;
  }
  destroy() {
    clearTimeout(this.timer);
    this.offer = null;
    this.view = undefined;
    this.render(this);
  }
}

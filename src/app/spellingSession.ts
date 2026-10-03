import { useRef, useState } from 'react';
import type { EditorView } from 'prosemirror-view';
import type { SpellcheckController } from '../application/spellcheck';

/** Component-owned handles the spelling session reads. Both are stable
 *  refs except the plain render values, which the hook re-reads every
 *  render — the same semantics as the previous inline callbacks. */
export interface SpellingSessionDeps {
  viewRef: { current: EditorView | null };
  popupRef: { current: { controller: { dismiss(): void } } | null };
}

export interface SpellingSession {
  spellingRef: { current: SpellcheckController | null };
  showSpelling: boolean;
  openSpelling: () => void;
  closeSpelling: () => void;
}

/** Owns the spellcheck session: controller ref, panel visibility and the
 *  open/close pair (previously inline one-liners in command dispatch and
 *  panel JSX; bodies byte-identical). The SpellcheckController itself is
 *  still created by the panel through onController and invalidated by
 *  the writing session lifecycle through the returned spellingRef. */
export function useSpellingSession(deps: SpellingSessionDeps): SpellingSession {
  const { viewRef, popupRef } = deps;
  const spellingRef = useRef<SpellcheckController | null>(null);
  const [showSpelling, setShowSpelling] = useState(false);

  const openSpelling = () => {
    popupRef.current?.controller.dismiss();
    setShowSpelling(true);
  };
  const closeSpelling = () => {
    setShowSpelling(false);
    viewRef.current?.focus();
  };

  return {
    spellingRef,
    showSpelling,
    openSpelling,
    closeSpelling,
  };
}

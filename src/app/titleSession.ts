import { useEffect, useRef, useState } from 'react';

/** Component-owned handles the title session reads. The popup ref is
 *  stable; the hook re-reads it every render — the same semantics as
 *  the previous inline callbacks. The draft/composing/applying refs
 *  stay composed in WritingView: the panel mutates them there and the
 *  find/check/spelling hooks read them, so moving them here would
 *  reopen those landed hooks. */
export interface TitleSessionDeps {
  popupRef: { current: { controller: { dismiss(): void } } | null };
}

export interface TitleSession {
  showTitle: boolean;
  titleButtonRef: { current: HTMLButtonElement | null };
  openTitle: () => void;
  closeTitle: () => void;
}

/** Owns the title-page session: panel visibility, the toolbar
 *  button/return-focus refs, the return-focus effect and the open/close
 *  pair (previously an inline dispatch site, an inline panel callback
 *  and a component effect; bodies byte-identical). */
export function useTitleSession(deps: TitleSessionDeps): TitleSession {
  const { popupRef } = deps;
  const [showTitle, setShowTitle] = useState(false);
  const titleButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleReturnFocusRef = useRef(false);

  const openTitle = () => {
    popupRef.current?.controller.dismiss();
    setShowTitle(true);
  };
  const closeTitle = () => {
    titleReturnFocusRef.current = true;
    setShowTitle(false);
  };
  useEffect(() => {
    if (!showTitle && titleReturnFocusRef.current) {
      titleReturnFocusRef.current = false;
      titleButtonRef.current?.focus();
    }
  }, [showTitle]);

  return {
    showTitle,
    titleButtonRef,
    openTitle,
    closeTitle,
  };
}

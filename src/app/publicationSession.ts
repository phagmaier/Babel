import { useRef, useState } from 'react';
import type {
  ExportPdfController,
  ExportPdfState,
} from '../application/exportPdf';
import type {
  PublicationPreviewController,
  PublicationPreviewState,
} from '../application/publicationPreview';
import type { ProjectionState } from '../application/manuscriptProjection';

export interface PublicationSessionDeps {
  outline: ProjectionState;
}

export interface PublicationSession {
  previewRef: { current: PublicationPreviewController | null };
  exportRef: { current: ExportPdfController | null };
  exportState: ExportPdfState | null;
  setExportState: (state: ExportPdfState | null) => void;
  previewButton: { current: HTMLButtonElement | null };
  previewState: PublicationPreviewState | null;
  setPreviewState: (state: PublicationPreviewState | null) => void;
  restorePreviewFocus: () => void;
  openPreview: () => void;
  closePreview: () => void;
  dismissExport: () => void;
}

/** Controller lifetime and focus-effect registration stay composed in
 * WritingView. Returned refs/setters retain their mount-once identities. */
export function usePublicationSession({
  outline,
}: PublicationSessionDeps): PublicationSession {
  const previewRef = useRef<PublicationPreviewController | null>(null);
  const exportRef = useRef<ExportPdfController | null>(null);
  const [exportState, setExportState] = useState<ExportPdfState | null>(null);
  const previewButton = useRef<HTMLButtonElement | null>(null);
  const previewFocusPending = useRef(false);
  const [previewState, setPreviewState] =
    useState<PublicationPreviewState | null>(null);

  const restorePreviewFocus = () => {
    if (!previewFocusPending.current || previewState?.enabled) return;
    const button = previewButton.current;
    // Closing during Save can remove the focused panel while the toolbar is
    // disabled. Wait for its next enabled commit, respecting any newer focus.
    if (
      document.activeElement !== document.body &&
      document.activeElement !== button
    ) {
      previewFocusPending.current = false;
    } else if (button && !button.disabled) {
      previewFocusPending.current = false;
      button.focus();
    }
  };
  const openPreview = () => {
    previewRef.current?.accept(outline);
    previewRef.current?.open();
  };
  const closePreview = () => {
    previewFocusPending.current = true;
    previewRef.current?.close();
  };
  const dismissExport = () => setExportState(null);

  return {
    previewRef,
    exportRef,
    exportState,
    setExportState,
    previewButton,
    previewState,
    setPreviewState,
    restorePreviewFocus,
    openPreview,
    closePreview,
    dismissExport,
  };
}

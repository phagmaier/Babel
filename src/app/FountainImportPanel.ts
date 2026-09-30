import type { FountainImportBoundary } from '../application/fountainImport';
/** Staged text remains visible after success/failure. This explicit replacement never handles paste. */
export function createFountainImportPanel(
  parent: HTMLElement,
  boundary: FountainImportBoundary,
) {
  const section = document.createElement('section');
  section.setAttribute('aria-label', 'Import Fountain');
  const label = document.createElement('label');
  label.textContent = 'Fountain screenplay to import';
  const input = document.createElement('textarea');
  input.setAttribute('aria-label', 'Fountain screenplay to import');
  label.append(input);
  const help = document.createElement('p');
  help.textContent =
    'Replace the whole screenplay. Your current draft will receive a recovery checkpoint and safety revision first. Undo restores it.';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Import Fountain as screenplay';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  let alive = true;
  let pending: AbortController | null = null;
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel import protection';
  cancel.hidden = true;
  cancel.onclick = () => {
    pending?.abort();
    cancel.disabled = true;
    status.textContent =
      'Import cancelled. Finishing protection; current and staged content retained.';
  };
  button.onclick = () => {
    pending = new AbortController();
    cancel.hidden = false;
    cancel.disabled = false;
    button.disabled = true;
    status.textContent = 'Protecting current draft…';
    void boundary
      .import(new TextEncoder().encode(input.value), pending.signal)
      .then((result) => {
        if (!alive) return;
        status.textContent =
          result.status === 'imported'
            ? 'Imported. Previous draft protected; Undo restores it. Source file has not been saved.'
            : result.reason;
        button.disabled = false;
        cancel.hidden = true;
        pending = null;
      });
  };
  section.append(label, help, button, cancel, status);
  parent.append(section);
  return {
    input,
    button,
    status,
    destroy() {
      alive = false;
      pending?.abort();
      button.onclick = null;
      section.remove();
    },
  };
}

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
  button.onclick = () => {
    button.disabled = true;
    status.textContent = 'Protecting current draft…';
    void boundary
      .import(new TextEncoder().encode(input.value))
      .then((result) => {
        if (!alive) return;
        status.textContent =
          result.status === 'imported'
            ? 'Imported. Previous draft protected; Undo restores it. Source file has not been saved.'
            : result.reason;
        button.disabled = false;
      });
  };
  section.append(label, help, button, status);
  parent.append(section);
  return {
    input,
    button,
    status,
    destroy() {
      alive = false;
      button.onclick = null;
      section.remove();
    },
  };
}

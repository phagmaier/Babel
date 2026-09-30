import { mountSpellcheckProbe } from './probe';
import '../editor-bridge/style.css';

const probe = mountSpellcheckProbe(
  document.querySelector<HTMLElement>('#editor')!,
);
Object.assign(window, { spellProbe: probe });
document.querySelector('#status')!.textContent = 'Synthetic offline spellcheck';
probe.select(0, 14);

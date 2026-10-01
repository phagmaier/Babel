/** Bounded advisory facts from the complete manuscript index, never authored state. */
import { cueName } from './completion';
import type { FountainDocument } from './fountainModel';
import {
  indexDescribesDocument,
  type ManuscriptIndex,
  type TextScope,
} from './manuscriptIndex';

export interface CharacterEntry {
  readonly name: string;
  readonly cues: readonly number[];
  readonly speechRows: readonly number[];
}
export interface CharacterCounts {
  readonly words: Readonly<Record<TextScope | 'outline', number>>;
  readonly scenes: number;
  readonly characters: readonly CharacterEntry[];
}
const words = new Intl.Segmenter('und', { granularity: 'word' });
export const COUNT_RULES =
  'Script words include logical headings, cues, dialogue, parentheticals, action, transitions, lyrics and centered text. Title, notes, omissions, raw text and outline (sections/synopses) are counted separately. Fountain markers, emphasis, blank lines and page breaks are excluded. Words use Unicode word segmentation; emoji and punctuation alone are not words. Scenes count recognized headings; characters count distinct exact cue spellings after trimming and removing extensions, excluding hidden/raw cues.';
export function buildCharacterCounts(
  document: FountainDocument,
  index: ManuscriptIndex,
): CharacterCounts {
  if (!indexDescribesDocument(index, document))
    throw new Error('Foreign index');
  const counts = { body: 0, title: 0, note: 0, omitted: 0, raw: 0, outline: 0 };
  for (const location of index.texts) {
    if (location.kind === 'pageBreak' || location.kind === 'blank') continue;
    const scope =
      location.scope === 'body' &&
      ['section', 'synopsis'].includes(location.kind)
        ? 'outline'
        : location.scope;
    for (const segment of words.segment(location.text))
      if (segment.isWordLike) counts[scope]++;
  }
  const names = new Map<
    string,
    { name: string; cues: number[]; speechRows: number[] }
  >();
  const speakers = new Map<
    string,
    { name: string; cues: number[]; speechRows: number[] }
  >();
  for (const location of index.texts) {
    const row = location.row,
      line = document.lines[row]!;
    if (
      location.scope !== 'body' ||
      line.kind !== 'character' ||
      !line.editable ||
      line.hiddenOf
    )
      continue;
    const name = cueName(location.text).name.trim();
    if (!name) continue;
    const entry = names.get(name) ?? { name, cues: [], speechRows: [] };
    entry.cues.push(row);
    names.set(name, entry);
    speakers.set(line.id, entry);
  }
  document.lines.forEach((line, row) => {
    if (
      line.editable &&
      !line.hiddenOf &&
      ['dialogue', 'parenthetical'].includes(line.kind) &&
      line.speechOf
    )
      speakers.get(line.speechOf)?.speechRows.push(row);
  });
  return Object.freeze({
    words: Object.freeze(counts),
    scenes: index.items.filter((item) => item.kind === 'scene').length,
    characters: Object.freeze(
      [...names.values()].map((entry) =>
        Object.freeze({
          name: entry.name,
          cues: Object.freeze(entry.cues),
          speechRows: Object.freeze(entry.speechRows),
        }),
      ),
    ),
  });
}

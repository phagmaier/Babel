/** Local derived vocabulary. Exact spellings remain distinct; no fuzzy identity merging. */
export interface CompletionRow {
  readonly kind: string;
  readonly text: string;
  readonly protected?: boolean;
  readonly hidden?: boolean;
  readonly recent?: number;
}
export interface VocabularyEntry {
  readonly text: string;
  readonly frequency: number;
  readonly recent: number;
}
export interface LocalVocabulary {
  readonly characters: readonly VocabularyEntry[];
  readonly locations: readonly VocabularyEntry[];
  readonly times: readonly VocabularyEntry[];
}
export const headingPrefixes = ['INT.', 'EXT.', 'INT./EXT.', 'EST.', 'I/E.'];
export const commonTimes = [
  'DAY',
  'NIGHT',
  'MORNING',
  'AFTERNOON',
  'EVENING',
  'DAWN',
  'DUSK',
  'LATER',
  'CONTINUOUS',
  'SAME TIME',
];
export function cueName(text: string) {
  // Keep multiple or still-being-drafted parenthesized extensions out of identity.
  const extension = /\s+\(/.exec(text);
  const end = extension?.index ?? text.length;
  return { name: text.slice(0, end), end };
}
export function headingSegments(text: string) {
  const prefix =
    /^(?:INT\.\/EXT\.|INT\/EXT\.|INT\.|EXT\.|EST\.|I\/E\.)(?:\s+|$)/i.exec(
      text,
    );
  const locationStart = prefix?.[0].length ?? 0;
  const dash = text.lastIndexOf(' - ');
  const locationEnd = dash >= locationStart ? dash : text.length;
  return {
    prefixEnd: prefix ? prefix[0].trimEnd().length : 0,
    locationStart,
    locationEnd,
    timeStart: dash >= locationStart ? dash + 3 : null,
  };
}
export function buildLocalVocabulary(
  rows: readonly CompletionRow[],
): LocalVocabulary {
  const characters = new Map<string, VocabularyEntry>();
  const locations = new Map<string, VocabularyEntry>();
  const times = new Map<string, VocabularyEntry>();
  function add(
    map: Map<string, VocabularyEntry>,
    text: string,
    recent: number,
  ) {
    text = text.trim();
    if (!text) return;
    const prior = map.get(text);
    map.set(
      text,
      Object.freeze({
        text,
        frequency: (prior?.frequency ?? 0) + 1,
        recent: Math.max(prior?.recent ?? 0, recent),
      }),
    );
  }
  rows.forEach((row, index) => {
    if (row.protected || row.hidden) return;
    const recent = row.recent ?? index;
    if (row.kind === 'character')
      add(characters, cueName(row.text).name, recent);
    if (row.kind === 'sceneHeading') {
      const segments = headingSegments(row.text);
      add(
        locations,
        row.text.slice(segments.locationStart, segments.locationEnd),
        recent,
      );
      if (segments.timeStart !== null)
        add(times, row.text.slice(segments.timeStart), recent);
    }
  });
  return Object.freeze({
    characters: Object.freeze([...characters.values()]),
    locations: Object.freeze([...locations.values()]),
    times: Object.freeze([...times.values()]),
  });
}
const fold = (text: string) => text.toLocaleLowerCase('und');
function matchRank(text: string, query: string) {
  const value = fold(text);
  const needle = fold(query.trim());
  if (value === needle) return 0;
  if (value.startsWith(needle)) return 1;
  if (needle.length < 2) return 3;
  let at = 0;
  for (const char of value) if (char === needle[at]) at++;
  return at === needle.length ? 2 : 3;
}
export function rankVocabulary(
  entries: readonly VocabularyEntry[],
  query: string,
): readonly string[] {
  return Object.freeze(
    entries
      .filter((entry) => matchRank(entry.text, query) < 3)
      .sort(
        (a, b) =>
          matchRank(a.text, query) - matchRank(b.text, query) ||
          b.frequency - a.frequency ||
          b.recent - a.recent ||
          a.text.localeCompare(b.text, 'en'),
      )
      .slice(0, 8)
      .map((entry) => entry.text),
  );
}
export function withBuiltins(
  entries: readonly VocabularyEntry[],
  builtins: readonly string[],
): readonly VocabularyEntry[] {
  return [
    ...entries,
    ...builtins
      .filter((text) => !entries.some((entry) => entry.text === text))
      .map((text) => ({ text, frequency: 0, recent: -1 })),
  ];
}

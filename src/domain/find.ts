/** Literal, scalar-safe matching over authored logical locations, never source syntax. */
import type {
  LogicalText,
  ManuscriptIndex,
  TextScope,
} from './manuscriptIndex';
export const MAX_FIND_QUERY = 1024;
export const MAX_FIND_MATCHES = 10_000;
const CHUNK = 16_384;
export interface FindOptions {
  readonly query: string;
  readonly caseSensitive: boolean;
  readonly wholeWord: boolean;
  readonly scope: 'script' | 'scene';
  readonly title: boolean;
  readonly note: boolean;
  readonly omitted: boolean;
  readonly raw: boolean;
}
export const defaultFindOptions: FindOptions = Object.freeze({
  query: '',
  caseSensitive: false,
  wholeWord: false,
  scope: 'script',
  title: true,
  note: true,
  omitted: true,
  raw: true,
});
export interface FindMatch {
  readonly location: LogicalText;
  readonly from: number;
  readonly to: number;
}
const word = (text: string) => /[\p{L}\p{M}\p{N}\p{Pc}]/u.test(text);
const scalarBoundary = (text: string, at: number) =>
  !(
    at > 0 &&
    at < text.length &&
    /[\uD800-\uDBFF]/.test(text[at - 1]!) &&
    /[\uDC00-\uDFFF]/.test(text[at]!)
  );
function fold(text: string, sensitive: boolean) {
  let value = '';
  const boundaries = new Map<number, number>([[0, 0]]);
  let offset = 0;
  for (const scalar of text) {
    value += sensitive ? scalar : scalar.toLowerCase();
    offset += scalar.length;
    boundaries.set(value.length, offset);
  }
  return { value, boundaries };
}
export function sceneRange(index: ManuscriptIndex, row: number) {
  return (
    index.items.find(
      (item) => item.kind === 'scene' && row >= item.row && row < item.endRow,
    ) ?? null
  );
}
/** Each yield bounds a search slice, including long single physical rows. */
export function* findSlices(
  index: ManuscriptIndex,
  options: FindOptions,
  sceneRow: number,
): Generator<readonly FindMatch[]> {
  if (options.query.length > MAX_FIND_QUERY)
    throw new RangeError(
      `Query exceeds ${MAX_FIND_QUERY} UTF-16 units. Shorten it.`,
    );
  if (!options.query) return;
  if (
    !Array.from(options.query).every(
      (s) => !(s.length === 1 && /[\uD800-\uDFFF]/.test(s)),
    )
  )
    throw new RangeError('Query contains incomplete Unicode input.');
  const needle = fold(options.query, options.caseSensitive).value;
  const scene = options.scope === 'scene' ? sceneRange(index, sceneRow) : null;
  if (options.scope === 'scene' && !scene)
    throw new RangeError(
      'The caret is outside a scene. Choose Full script or enter a scene.',
    );
  let count = 0;
  for (const location of index.texts) {
    const scope: TextScope = location.scope;
    if (
      (scope !== 'body' && !options[scope]) ||
      (scene && (location.row < scene.row || location.row >= scene.endRow))
    )
      continue;
    let nextAllowed = 0;
    for (let start = 0; start < location.text.length;) {
      let end = Math.min(location.text.length, start + CHUNK);
      if (!scalarBoundary(location.text, end)) end++;
      let tail = Math.min(location.text.length, end + options.query.length * 2);
      if (!scalarBoundary(location.text, tail)) tail++;
      const { value, boundaries } = fold(
        location.text.slice(start, tail),
        options.caseSensitive,
      );
      const matches: FindMatch[] = [];
      for (
        let at = value.indexOf(needle);
        at >= 0;
        at = value.indexOf(needle, at + 1)
      ) {
        const left = boundaries.get(at),
          right = boundaries.get(at + needle.length);
        if (left === undefined || right === undefined) continue;
        const from = start + left,
          to = start + right;
        if (from >= end) break;
        if (from < nextAllowed) continue;
        if (
          options.wholeWord &&
          (word(
            Array.from(location.text.slice(Math.max(0, from - 2), from)).at(
              -1,
            ) ?? '',
          ) ||
            word(String.fromCodePoint(location.text.codePointAt(to) ?? 32)))
        )
          continue;
        if (++count > MAX_FIND_MATCHES)
          throw new RangeError(
            `More than ${MAX_FIND_MATCHES.toLocaleString('en-US')} matches. Refine the query or scope; navigation is disabled.`,
          );
        matches.push(Object.freeze({ location, from, to }));
        nextAllowed = to;
      }
      yield Object.freeze(matches);
      start = end;
    }
  }
}

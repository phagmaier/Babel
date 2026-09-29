/** Escaping is syntax context, never a source rewrite. */
export function isEscaped(text: string, at: number): boolean {
  let slash = at - 1;
  while (slash >= 0 && text[slash] === '\\') slash--;
  return (at - slash - 1) % 2 === 1;
}
export function unescapedIndex(
  text: string,
  marker: string,
  start = 0,
): number {
  for (
    let at = text.indexOf(marker, start);
    at >= 0;
    at = text.indexOf(marker, at + 1)
  ) {
    if (!isEscaped(text, at)) return at;
  }
  return -1;
}

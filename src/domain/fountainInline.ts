import type {
  InlineContent,
  InlineDelimiter,
  InlineRun,
  InlineStyle,
  StyledText,
} from './fountainModel.ts';

const escapable = /[\\*_[\]]/;
const styleOrder: readonly InlineStyle[] = ['bold', 'italic', 'underline'];
const markers: Record<string, readonly InlineStyle[]> = {
  '*': ['italic'],
  '**': ['bold'],
  '***': ['bold', 'italic'],
  _: ['underline'],
};
const ordered = (styles: readonly InlineStyle[]) =>
  styleOrder.filter((style) => styles.includes(style));

/** No normalization. Unpaired markers stay literal with an incomplete flag. */
export function parseInline(source: string): InlineContent {
  const runs: InlineRun[] = [];
  const delimiters: InlineDelimiter[] = [];
  let complete = true;
  const markerAt = (at: number, end: number) => {
    if (source[at] !== '*' && source[at] !== '_') return '';
    let next = at + 1;
    while (next < end && source[next] === source[at]) next++;
    return source.slice(at, next);
  };
  const emit = (
    text: string,
    start: number,
    end: number,
    styles: readonly InlineStyle[],
  ) => {
    const prior = runs.at(-1);
    const sorted = ordered(styles);
    if (
      prior &&
      prior.end === start &&
      JSON.stringify(prior.styles) === JSON.stringify(sorted)
    ) {
      runs[runs.length - 1] = { ...prior, text: prior.text + text, end };
    } else runs.push({ text, start, end, styles: sorted });
  };
  const parseRange = (
    start: number,
    end: number,
    styles: readonly InlineStyle[],
    depth: number,
  ) => {
    if (depth > 32) {
      complete = false;
      emit(source.slice(start, end), start, end, styles);
      return;
    }
    for (let at = start; at < end;) {
      if (
        source[at] === '\\' &&
        escapable.test(source[at + 1] ?? '') &&
        at + 1 < end
      ) {
        emit(source[at + 1]!, at, at + 2, styles);
        at += 2;
        continue;
      }
      const marker = markerAt(at, end);
      if (marker) {
        const inside = at + marker.length;
        let close = -1;
        if (markers[marker] && inside < end && !/\s/.test(source[inside]!)) {
          const stack = [marker];
          search: for (let search = inside; search < end;) {
            if (
              source[search] === '\\' &&
              escapable.test(source[search + 1] ?? '')
            ) {
              search += 2;
              continue;
            }
            const candidate = markerAt(search, end);
            if (!candidate) {
              search++;
              continue;
            }
            const canClose = search > inside && !/\s/.test(source[search - 1]!);
            const canOpen =
              search + candidate.length < end &&
              !/\s/.test(source[search + candidate.length]!);
            let consumed = 0;
            if (canClose) {
              while (stack.length) {
                const top = stack.at(-1)!;
                if (
                  top[0] !== candidate[0] ||
                  candidate.length - consumed < top.length
                )
                  break;
                stack.pop();
                if (!stack.length) {
                  close = search + consumed;
                  break search;
                }
                consumed += top.length;
              }
            }
            const remaining = candidate.slice(consumed);
            if (remaining && markers[remaining] && canOpen)
              stack.push(remaining);
            search += candidate.length;
          }
        }
        if (close >= 0) {
          delimiters.push({
            marker,
            start: at,
            end: inside,
            closingStart: close,
            closingEnd: close + marker.length,
          });
          parseRange(
            inside,
            close,
            [...styles, ...markers[marker]!],
            depth + 1,
          );
          at = close + marker.length;
        } else {
          complete = false;
          emit(marker, at, inside, styles);
          at = inside;
        }
        continue;
      }
      let next = at + 1;
      while (
        next < end &&
        source[next] !== '*' &&
        source[next] !== '_' &&
        source[next] !== '\\'
      )
        next++;
      emit(source.slice(at, next), at, next, styles);
      at = next;
    }
  };
  parseRange(0, source.length, [], 0);
  return Object.freeze({
    text: runs.map((run) => run.text).join(''),
    complete,
    runs: Object.freeze(
      runs.map((run) =>
        Object.freeze({ ...run, styles: Object.freeze([...run.styles]) }),
      ),
    ),
    delimiters: Object.freeze(
      delimiters
        .sort((a, b) => a.start - b.start)
        .map((delimiter) => Object.freeze(delimiter)),
    ),
  });
}

/** A specified rich projection, excluding offsets and normalizing only adjacent identical styles. */
export function richView(runs: readonly StyledText[]): StyledText[] {
  const output: { text: string; styles: InlineStyle[] }[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const styles = ordered(run.styles);
    const previous = output.at(-1);
    if (previous && JSON.stringify(previous.styles) === JSON.stringify(styles))
      previous.text += run.text;
    else output.push({ text: run.text, styles });
  }
  return output;
}

/** Caller validates grammar context as well as these inline semantics before publishing. */
export function sourceForInline(runs: readonly StyledText[]): string {
  for (const run of runs) {
    if (
      typeof run.text !== 'string' ||
      /[\r\n]/.test(run.text) ||
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
        run.text,
      ) ||
      run.styles.some((style) => !styleOrder.includes(style))
    )
      throw new Error(
        'Invalid inline text/style; use a source copy or an explicit break transaction',
      );
  }
  const expected = richView(runs);
  const render = (items: readonly StyledText[], depth: number): string => {
    if (depth > 8) throw new Error('Unsupported style nesting');
    if (!items.length) return '';
    const common = styleOrder.filter((style) =>
      items.every((item) => item.styles.includes(style)),
    );
    if (common.length) {
      const stars = common.includes('bold')
        ? common.includes('italic')
          ? '***'
          : '**'
        : common.includes('italic')
          ? '*'
          : '';
      const underline = common.includes('underline') ? '_' : '';
      return (
        underline +
        stars +
        render(
          items.map((item) => ({
            text: item.text,
            styles: item.styles.filter((style) => !common.includes(style)),
          })),
          depth + 1,
        ) +
        stars +
        underline
      );
    }
    let result = '';
    for (let from = 0; from < items.length;) {
      const first = items[from]!;
      if (!first.styles.length) {
        result += first.text.replace(/[\\*_[\]]/g, '\\$&');
        from++;
        continue;
      }
      let end = from + 1;
      while (
        end < items.length &&
        items[end]!.styles.some((style) => first.styles.includes(style))
      )
        end++;
      const group = items.slice(from, end);
      if (
        !styleOrder.some((style) =>
          group.every((item) => item.styles.includes(style)),
        )
      )
        end = from + 1;
      result += render(items.slice(from, end), depth + 1);
      from = end;
    }
    return result;
  };
  const encoded = render(expected, 0);
  const parsed = parseInline(encoded);
  // Parsing escapes is faithful even when literal markers remain visibly incomplete.
  if (
    !parsed.complete ||
    JSON.stringify(richView(parsed.runs)) !== JSON.stringify(expected)
  )
    throw new Error(
      'Inline style boundaries cannot be represented unambiguously in Fountain',
    );
  return encoded;
}

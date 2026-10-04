// EDIT-07 real-layout check: production writing.css against the schema's own
// toDOM output in Chromium. Browser evidence only; native WebKit is separate.

// Column fractions from us-letter-draft-v1: 432 pt frame at 7.2 pt per
// character is 60 columns. [left indent, width] in columns.
const COLUMNS = 60;
const INDENTED = {
  character: [22, 38],
  dialogue: [10, 35],
  parenthetical: [16, 30],
};
const CASES = [
  { name: '100% wide', width: 1280, zoom: 100, full: true },
  { name: '200% wide', width: 1280, zoom: 200, full: true },
  { name: '200% medium', width: 1000, zoom: 200, full: false },
  { name: '100% narrow', width: 420, zoom: 100, full: false },
];
const TOLERANCE = 1;

async function measure(page, zoom) {
  return page.evaluate(async (zoom) => {
    const { document, getComputedStyle, innerWidth } = globalThis;
    const { screenplaySchema, screenplayKinds } =
      await import('/src/editor/schema.ts');
    await import('/src/app/writing.css');
    const main = document.createElement('main');
    main.className = 'shell writing';
    const host = document.createElement('div');
    host.style.fontSize = `${zoom / 100}rem`;
    const root = document.createElement('div');
    root.className = 'ProseMirror';
    host.append(root);
    main.append(host);
    document.body.append(main);
    const text = 'MMMM';
    const rows = screenplayKinds.map((kind) => {
      const type = screenplaySchema.nodes[kind];
      const node = type.create({ id: kind }, screenplaySchema.text(text));
      const [tag, attrs] = type.spec.toDOM(node);
      const row = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs))
        row.setAttribute(key, value);
      row.textContent = text;
      root.append(row);
      return { kind, row };
    });
    const style = getComputedStyle(root);
    const outer = root.getBoundingClientRect();
    const left =
      outer.left +
      parseFloat(style.borderLeftWidth) +
      parseFloat(style.paddingLeft);
    const right =
      outer.right -
      parseFloat(style.borderRightWidth) -
      parseFloat(style.paddingRight);
    const mainStyle = getComputedStyle(main);
    const mainRect = main.getBoundingClientRect();
    const result = {
      column: right - left,
      before: outer.left - (mainRect.left + parseFloat(mainStyle.paddingLeft)),
      after: mainRect.right - parseFloat(mainStyle.paddingRight) - outer.right,
      overflow: document.documentElement.scrollWidth - innerWidth,
      rows: rows.map(({ kind, row }) => {
        const range = document.createRange();
        range.selectNodeContents(row);
        const ink = range.getBoundingClientRect();
        const box = row.getBoundingClientRect();
        const computed = getComputedStyle(row);
        return {
          kind,
          left: box.left - left,
          width: box.width,
          inkLeft: ink.left - left,
          inkRight: right - ink.right,
          character: ink.width / text.length,
          transform: computed.textTransform,
          generated: [
            getComputedStyle(row, '::before').content,
            getComputedStyle(row, '::after').content,
          ],
          shown: row.innerText,
        };
      }),
    };
    main.remove();
    return result;
  }, zoom);
}

export async function checkElementLayout(page) {
  const original = page.viewportSize();
  const failures = [];
  const near = (actual, expected) => Math.abs(actual - expected) <= TOLERANCE;
  for (const { name, width, zoom, full } of CASES) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await measure(page, zoom);
    const fail = (message) => failures.push(`${name}: ${message}`);
    const columns = layout.column / layout.rows[0].character;
    if (
      full
        ? !near(layout.column, COLUMNS * layout.rows[0].character)
        : columns >= COLUMNS - 1
    )
      fail(`writing column is ${columns.toFixed(2)} characters wide`);
    if (!near(layout.before, layout.after))
      fail(`column not centred (${layout.before} / ${layout.after})`);
    if (layout.overflow > 0) fail(`horizontal overflow ${layout.overflow}px`);
    for (const row of layout.rows) {
      const [indent, span] = INDENTED[row.kind] ?? [0, COLUMNS];
      const wantLeft = (indent / COLUMNS) * layout.column;
      const wantWidth = (span / COLUMNS) * layout.column;
      if (!near(row.left, wantLeft) || !near(row.width, wantWidth))
        fail(
          `${row.kind} box left ${row.left} width ${row.width}; expected ${wantLeft} / ${wantWidth}`,
        );
      if (row.kind === 'transition' && !near(row.inkRight, 0))
        fail(`transition text ends ${row.inkRight}px before the right edge`);
      if (row.kind === 'centered' && !near(row.inkLeft, row.inkRight))
        fail(`centered text offset ${row.inkLeft} / ${row.inkRight}`);
      if (
        row.kind !== 'transition' &&
        row.kind !== 'centered' &&
        !near(row.inkLeft, wantLeft)
      )
        fail(`${row.kind} text starts at ${row.inkLeft}; expected ${wantLeft}`);
      // Presentation must never show text the source does not contain.
      if (row.transform !== 'none') fail(`${row.kind} uses text-transform`);
      if (row.generated.some((content) => content !== 'none'))
        fail(`${row.kind} has generated content`);
      if (row.shown.trim() !== 'MMMM')
        fail(`${row.kind} displays ${JSON.stringify(row.shown)}`);
    }
  }
  if (original) await page.setViewportSize(original);
  if (failures.length)
    throw new Error('Element layout check failed:\n' + failures.join('\n'));
  return CASES.map(({ name }) => name);
}

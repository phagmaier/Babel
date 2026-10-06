// AUDIT-D03B real-layout check: production CSS over the shell's region classes
// in Chromium. The mounted WritingView test owns the production DOM structure;
// this owns geometry. Browser evidence only; native WebKit is separate.

const TOLERANCE = 1;
const ALERT =
  'Newer changes exist only in memory until protection is confirmed.';

async function build(page, { zoom = 100, drawer = true } = {}) {
  await page.evaluate(
    async ({ zoom, drawer }) => {
      const { document } = globalThis;
      await import('/src/app/writing.css');
      await import('/src/app/outline.css');
      document.querySelector('#shell-layout-check')?.remove();
      document.getElementById('root').hidden = true;
      const make = (tag, attrs = {}, children = []) => {
        const node = document.createElement(tag);
        for (const [key, value] of Object.entries(attrs))
          if (key === 'text') node.textContent = value;
          else node.setAttribute(key, value);
        node.append(...children);
        return node;
      };
      const repeat = (count, each) => Array.from({ length: count }, each);
      const header = make('div', { class: 'writing-presentation' }, [
        make('section', { class: 'presentation' }, [
          make('div', { class: 'presentation-controls' }, [
            make('label', { text: 'Theme' }, [make('select')]),
            make('label', { text: 'Writing zoom' }, [make('select')]),
            make('button', { id: 'writing-focus', text: 'Focus mode' }),
            make('label', { text: 'Typewriter scroll' }),
          ]),
        ]),
        make('section', { class: 'protection-status' }, [
          make('p', { role: 'status', text: 'Changes pending' }),
          make('details', {}, [make('summary', { text: 'Save details' })]),
        ]),
      ]);
      const top = make('div', { class: 'writing-top' }, [
        make('h1', { text: 'Writing' }),
        make('p', { class: 'focus-help', text: 'F6 moves focus.' }),
        make(
          'div',
          { class: 'actions' },
          repeat(12, (_, index) =>
            make('button', {
              id: index === 2 ? 'writing-save' : `action-${index}`,
              text: index === 2 ? 'Save' : `Action ${index}`,
            }),
          ),
        ),
        make('section', { class: 'editor-controls', text: 'Element picker' }),
      ]);
      const tools = make('div', { class: 'writing-drawer' }, [
        make('section', { class: 'find-panel' }, [
          make('label', { text: 'Find text' }, [
            make('input', { type: 'search' }),
          ]),
          make(
            'ol',
            {},
            repeat(80, (_, index) => make('li', { text: `Match ${index}` })),
          ),
        ]),
      ]);
      const sidebar = make('div', { class: 'writing-sidebar' }, [
        make('aside', { class: 'character-panel', text: 'Characters' }),
        make('nav', { class: 'manuscript-outline' }, [
          make('h2', { text: 'Outline' }),
          make('div', { class: 'outline-headings' }, [
            make(
              'ol',
              {},
              repeat(200, (_, index) =>
                make('li', {}, [
                  make('div', { class: 'outline-row' }, [
                    make('button', {
                      class: 'outline-target',
                      text: `${index}. INT. ROOM ${index} - DAY`,
                    }),
                  ]),
                ]),
              ),
            ),
          ]),
        ]),
      ]);
      const editor = make(
        'div',
        { class: 'ProseMirror' },
        repeat(400, (_, index) =>
          make('p', {
            'data-kind': 'action',
            'data-row': String(index),
            text: `Row ${index}: the lamp glows over the gallery glass.`,
          }),
        ),
      );
      const host = make('div', { style: `font-size:${zoom / 100}rem` }, [
        editor,
      ]);
      const main = make('main', { id: 'shell-layout-check' }, [
        header,
        top,
        ...(drawer ? [tools] : []),
        sidebar,
        make('div', { class: 'writing-body' }, [host]),
        make('div', { class: 'writing-tail' }, [
          make('section', { class: 'snapshot-panel', text: 'Snapshots' }),
        ]),
      ]);
      main.className = 'shell writing';
      document.body.append(main);
      // Mirrors WritingView's header measurement effect.
      document.documentElement.style.setProperty(
        '--writing-header',
        `${header.getBoundingClientRect().height}px`,
      );
    },
    { zoom, drawer },
  );
}

async function measure(page) {
  return page.evaluate(() => {
    const { document, getComputedStyle, innerHeight, innerWidth } = globalThis;
    const main = document.querySelector('#shell-layout-check');
    const rect = (selector) => {
      const node = main.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
        display: style.display,
        position: style.position,
        scrolls: node.scrollHeight > node.clientHeight + 1,
      };
    };
    const style = getComputedStyle(main);
    const box = main.getBoundingClientRect();
    return {
      innerHeight,
      overflow: document.documentElement.scrollWidth - innerWidth,
      display: style.display,
      contentLeft: box.left + parseFloat(style.paddingLeft),
      contentRight: box.right - parseFloat(style.paddingRight),
      header: rect('.writing-presentation'),
      top: rect('.writing-top'),
      heading: rect('.writing-top > h1'),
      save: rect('#writing-save'),
      drawer: rect('.writing-drawer'),
      sidebar: rect('.writing-sidebar'),
      body: rect('.writing-body'),
      editor: rect('.ProseMirror'),
      tail: rect('.writing-tail'),
      probe: rect('p[data-row="150"]'),
    };
  });
}

async function finish(page) {
  await page.evaluate(() => {
    const { document, scrollTo } = globalThis;
    document.querySelector('#shell-layout-check')?.remove();
    document.documentElement.style.removeProperty('--writing-header');
    document.getElementById('root').hidden = false;
    scrollTo(0, 0);
  });
}

export async function checkShellLayout(page) {
  const original = page.viewportSize();
  const failures = [];
  const near = (actual, expected, tolerance = TOLERANCE) =>
    Math.abs(actual - expected) <= tolerance;
  const check = (name, condition, detail) => {
    if (!condition) failures.push(`${name}: ${JSON.stringify(detail)}`);
  };

  // Wide window with a tool panel open: three columns under one header.
  await page.setViewportSize({ width: 1600, height: 900 });
  await build(page);
  let m = await measure(page);
  check('wide grid', m.display === 'grid' && m.overflow <= 0, m.display);
  check(
    'header spans the shell',
    near(m.header.left, m.contentLeft) && near(m.header.right, m.contentRight),
    m.header,
  );
  check(
    'navigator left of script',
    m.sidebar.right <= m.body.left && near(m.sidebar.left, m.contentLeft),
    [m.sidebar, m.body],
  );
  check(
    'tools right of script',
    m.drawer.left >= m.body.right && near(m.drawer.right, m.contentRight),
    [m.drawer, m.body],
  );
  check(
    'actions share the script column',
    near(m.top.left, m.body.left) && m.top.bottom <= m.body.top + TOLERANCE,
    [m.top, m.body],
  );
  check(
    'editor centred in its column',
    near(m.editor.left - m.body.left, m.body.right - m.editor.right),
    [m.editor, m.body],
  );

  // The window scrolls the script; side columns stay under the header.
  const unscrolled = m;
  await page.evaluate(() => globalThis.scrollTo(0, 3000));
  m = await measure(page);
  check('header pinned', near(m.header.top, 0), m.header);
  for (const name of ['sidebar', 'drawer']) {
    check(
      `${name} pinned under header`,
      near(m[name].top, m.header.bottom + 12) &&
        m[name].bottom <= m.innerHeight &&
        m[name].position === 'sticky' &&
        (name === 'drawer' || m[name].scrolls),
      m[name],
    );
  }
  check(
    'script scrolled with the window',
    near(unscrolled.probe.top - m.probe.top, 3000),
    m.probe,
  );

  // An alert that comes and goes must not move the script under the caret.
  const before = m;
  await page.evaluate((text) => {
    const alert = globalThis.document.createElement('p');
    alert.setAttribute('role', 'alert');
    alert.textContent = text;
    globalThis.document
      .querySelector('#shell-layout-check .protection-status [role="status"]')
      .after(alert);
  }, ALERT);
  m = await measure(page);
  check(
    'alert keeps header height and script position',
    near(m.header.height, before.header.height, 0.5) &&
      near(m.probe.top, before.probe.top, 0.5),
    {
      before: [before.header.height, before.probe.top],
      after: [m.header.height, m.probe.top],
    },
  );

  // Focus mode: navigator and secondary controls go; Save stays.
  await page.evaluate(() => {
    globalThis.scrollTo(0, 0);
    globalThis.document
      .querySelector('#shell-layout-check')
      .classList.add('writing-focus');
  });
  m = await measure(page);
  check(
    'focus mode',
    m.sidebar.display === 'none' &&
      m.heading.display === 'none' &&
      m.save.height > 0 &&
      near(m.body.left, m.contentLeft),
    [m.sidebar.display, m.heading.display, m.save, m.body],
  );

  // No tool panel open: the script column reaches the right edge.
  await build(page, { drawer: false });
  m = await measure(page);
  check(
    'no drawer column',
    m.drawer === null && near(m.body.right, m.contentRight),
    m.body,
  );

  // 200% zoom keeps everything inside the window.
  await build(page, { zoom: 200 });
  m = await measure(page);
  check(
    '200% zoom',
    m.overflow <= 0 &&
      m.editor.left >= m.body.left - TOLERANCE &&
      m.editor.right <= m.body.right + TOLERANCE,
    [m.overflow, m.editor, m.body],
  );

  // Narrow window: one column, script before the navigator (PILOT-2026-10-06).
  // Visual order only; DOM/keyboard order is pinned by the WritingView test.
  await page.setViewportSize({ width: 900, height: 900 });
  await build(page);
  m = await measure(page);
  check(
    'narrow stack',
    m.display === 'flex' &&
      m.overflow <= 0 &&
      m.sidebar.position === 'static' &&
      m.drawer.position === 'static' &&
      m.top.bottom <= m.drawer.top + TOLERANCE &&
      m.drawer.bottom <= m.body.top + TOLERANCE &&
      m.body.bottom <= m.sidebar.top + TOLERANCE &&
      m.sidebar.bottom <= m.tail.top + TOLERANCE &&
      near(m.sidebar.left, m.body.left) &&
      near(m.drawer.right, m.body.right),
    [m.display, m.overflow, m.top, m.drawer, m.body, m.sidebar, m.tail],
  );

  await finish(page);
  if (original) await page.setViewportSize(original);
  if (failures.length)
    throw new Error('Shell layout check failed:\n' + failures.join('\n'));
  return [
    'three columns',
    'sticky side columns',
    'stable header',
    'focus mode',
    'no drawer',
    '200% zoom',
    'narrow stack',
  ];
}

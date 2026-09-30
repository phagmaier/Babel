import { useEffect, useMemo, useState } from 'react';
import type { ProjectionState } from '../application/manuscriptProjection';
import type { OutlineItem } from '../domain/manuscriptIndex';
import './outline.css';

export const OUTLINE_RENDER_LIMIT = 1_000;
const excerpt = (text: string) => {
  if (text.length <= 500) return text;
  const end = /[\uD800-\uDBFF]/.test(text[499]!) ? 499 : 500;
  return `${text.slice(0, end)}… (abbreviated)`;
};

export function Outline({
  state,
  disabled = false,
  onNavigate,
}: {
  state: ProjectionState;
  disabled?: boolean;
  onNavigate: (item: OutlineItem) => void;
}) {
  const index = state.projection?.index;
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [filter, setFilter] = useState<{
    index: typeof index;
    query: string;
    allowed: ReadonlySet<string> | null;
  }>({ index: undefined, query: '', allowed: null });
  const byId = useMemo(
    () => new Map(index?.items.map((item) => [item.id, item])),
    [index],
  );
  useEffect(() => {
    setCollapsed(new Set());
  }, [state.projection?.session]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const needle = query.trim().toLocaleLowerCase();
      const allowed = needle ? new Set<string>() : null;
      if (allowed)
        for (const item of index?.items ?? []) {
          if (
            ![item.label, item.sceneNumber ?? '', ...item.synopses].some(
              (text) => text.toLocaleLowerCase().includes(needle),
            )
          )
            continue;
          let current: OutlineItem | undefined = item;
          while (current && !allowed.has(current.id)) {
            allowed.add(current.id);
            current = current.parentId ? byId.get(current.parentId) : undefined;
          }
        }
      setFilter({ index, query, allowed });
    }, 20);
    return () => clearTimeout(timer);
  }, [index, query, byId]);
  const filtering = filter.index !== index || filter.query !== query;
  const canNavigate = state.phase === 'current' && !disabled && !filtering;
  let shown = 0;
  let eligible = 0;
  const renderItems = (ids: readonly string[]): React.ReactNode => {
    const children: React.ReactNode[] = [];
    for (const id of ids) {
      const item = byId.get(id);
      if (!item || (filter.allowed && !filter.allowed.has(id))) continue;
      eligible++;
      const display = shown++ < OUTLINE_RENDER_LIMIT;
      const closed = !query.trim() && collapsed.has(id);
      const nested = !closed ? renderItems(item.children) : null;
      if (!display) continue;
      const heading = excerpt(item.label);
      const label =
        item.kind === 'scene'
          ? `Scene ${item.ordinal}: ${heading}`
          : `Section: ${heading}`;
      children.push(
        <li key={id}>
          <div className="outline-row">
            {item.children.length > 0 && (
              <button
                type="button"
                className="outline-toggle"
                aria-label={`${closed ? 'Expand' : 'Collapse'} ${heading}`}
                aria-expanded={!closed}
                disabled={Boolean(query.trim())}
                onClick={() =>
                  setCollapsed((previous) => {
                    const next = new Set(previous);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
              >
                {closed ? '+' : '−'}
              </button>
            )}
            <button
              type="button"
              className="outline-target"
              aria-label={`Go to ${label}`}
              disabled={!canNavigate}
              onClick={() => onNavigate(item)}
            >
              {item.kind === 'scene' && (
                <span className="outline-ordinal">{item.ordinal}. </span>
              )}
              {heading || '(Untitled section)'}
              {item.sceneNumber !== null && (
                <small> Authored #{excerpt(item.sceneNumber)}#</small>
              )}
            </button>
          </div>
          {item.synopses.slice(0, 10).map((text, at) => (
            <p className="outline-synopsis" key={at}>
              {excerpt(text)}
            </p>
          ))}
          {item.synopses.length > 10 && (
            <p className="outline-synopsis">
              Showing 10 of {item.synopses.length} synopsis lines. Navigate to
              this heading to read all text.
            </p>
          )}
          {nested}
        </li>,
      );
    }
    return children.length ? <ol>{children}</ol> : null;
  };
  const tree = renderItems(index?.roots ?? []);
  return (
    <nav className="manuscript-outline" aria-label="Manuscript outline">
      <h2>Outline</h2>
      <label>
        Filter outline{' '}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p role="status">
        {state.phase === 'current'
          ? filtering
            ? 'Filtering outline…'
            : 'Outline is current. Choose a heading to return to the editor.'
          : state.message}
      </p>
      {index && index.items.length === 0 && (
        <p>No scenes or sections yet. All text remains in the editor.</p>
      )}
      {index && index.items.length > 0 && !tree && !filtering && (
        <p>No outline matches.</p>
      )}
      {eligible > OUTLINE_RENDER_LIMIT && (
        <p role="status">
          Showing the first {OUTLINE_RENDER_LIMIT} of {eligible} expanded
          matching headings. Collapse sections or narrow the filter to reach
          more headings. The manuscript index is complete.
        </p>
      )}
      <div
        className="outline-headings"
        aria-busy={filtering || state.phase === 'pending'}
      >
        {tree}
      </div>
    </nav>
  );
}

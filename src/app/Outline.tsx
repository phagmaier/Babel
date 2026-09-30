import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectionState } from '../application/manuscriptProjection';
import type { OutlineItem } from '../domain/manuscriptIndex';
import './outline.css';
import type { MoveRequest } from '../domain/sceneMoves';

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
  onMove,
  moveDisabled = false,
}: {
  state: ProjectionState;
  disabled?: boolean;
  onNavigate: (item: OutlineItem) => void;
  onMove?: (request: MoveRequest) => void;
  moveDisabled?: boolean;
}) {
  const index = state.projection?.index;
  const [query, setQuery] = useState('');
  const drag = useRef<{
    id: string;
    projection: typeof state.projection;
    pointerId: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const [selectedMove, setSelectedMove] = useState('');
  const [targetMove, setTargetMove] = useState('');
  const [placement, setPlacement] = useState<'before' | 'after'>('before');
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
  const canMove = canNavigate && !moveDisabled && Boolean(onMove);
  const peers = useMemo(() => {
    const groups = new Map<string, OutlineItem[]>();
    for (const item of index?.items ?? []) {
      const key = `${item.kind}:${item.parentId}:${item.level}`;
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    const result = new Map<
      string,
      { previous?: OutlineItem; next?: OutlineItem }
    >();
    for (const group of groups.values())
      group.forEach((item, at) =>
        result.set(item.id, { previous: group[at - 1], next: group[at + 1] }),
      );
    return result;
  }, [index]);
  const moveOptions =
    index?.items
      .filter((item) => !filter.allowed || filter.allowed.has(item.id))
      .slice(0, OUTLINE_RENDER_LIMIT) ?? [];
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
          <div className="outline-row" data-outline-id={id}>
            {onMove && (
              <button
                type="button"
                className="outline-drag"
                tabIndex={-1}
                aria-label={`Drag ${label} to preview move`}
                title="Drag onto a heading to preview a move. Keyboard: use Move up/down or destination controls."
                disabled={!canMove}
                onPointerDown={(event) => {
                  if (!canMove || event.button !== 0) return;
                  event.preventDefault();
                  drag.current = {
                    id,
                    projection: state.projection,
                    pointerId: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    moved: false,
                  };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const intent = drag.current;
                  if (
                    intent &&
                    intent.pointerId === event.pointerId &&
                    Math.hypot(
                      event.clientX - intent.x,
                      event.clientY - intent.y,
                    ) >= 6
                  )
                    intent.moved = true;
                }}
                onPointerUp={(event) => {
                  const intent = drag.current;
                  drag.current = null;
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  const projection = state.projection;
                  if (
                    !canMove ||
                    !intent?.moved ||
                    intent.pointerId !== event.pointerId ||
                    !intent.projection ||
                    !projection ||
                    intent.projection.session !== projection.session ||
                    intent.projection.version !== projection.version ||
                    intent.projection.doc !== projection.doc
                  )
                    return;
                  const row = document
                    .elementFromPoint(event.clientX, event.clientY)
                    ?.closest<HTMLElement>('.outline-row[data-outline-id]');
                  if (
                    !row ||
                    !event.currentTarget.closest('nav')?.contains(row)
                  )
                    return;
                  onMove({
                    itemId: intent.id,
                    targetId: row.dataset.outlineId!,
                    placement: 'before',
                  });
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
                onLostPointerCapture={() => {
                  drag.current = null;
                }}
              >
                ⠿
              </button>
            )}
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
            {onMove && (
              <>
                <button
                  type="button"
                  aria-label={`Move ${label} up`}
                  disabled={!canMove || !peers.get(id)?.previous}
                  onClick={() =>
                    onMove({
                      itemId: id,
                      targetId: peers.get(id)!.previous!.id,
                      placement: 'before',
                    })
                  }
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${label} down`}
                  disabled={!canMove || !peers.get(id)?.next}
                  onClick={() =>
                    onMove({
                      itemId: id,
                      targetId: peers.get(id)!.next!.id,
                      placement: 'after',
                    })
                  }
                >
                  ↓
                </button>
              </>
            )}
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
    <nav
      className="manuscript-outline"
      aria-label="Manuscript outline"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'none';
      }}
      onDrop={(event) => event.preventDefault()}
    >
      <h2>Outline</h2>
      {onMove && (
        <p>
          Drag a handle onto a heading to preview placement before it. Keyboard:
          use Move up/down or destination controls.
        </p>
      )}
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
      {onMove && (
        <details>
          <summary>Move to another heading with the keyboard</summary>
          <p>
            Choose from the first 1,000 matching headings. Filter the outline to
            reach other headings.
          </p>
          <label>
            Heading to move
            <select
              aria-label="Heading to move"
              disabled={!canMove}
              value={selectedMove}
              onChange={(event) => setSelectedMove(event.target.value)}
            >
              <option value="">Choose heading</option>
              {moveOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.kind === 'scene' ? `Scene ${item.ordinal}` : 'Section'}:{' '}
                  {excerpt(item.label)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Destination heading
            <select
              aria-label="Destination heading"
              disabled={!canMove}
              value={targetMove}
              onChange={(event) => setTargetMove(event.target.value)}
            >
              <option value="">Choose destination</option>
              {moveOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.kind === 'scene' ? `Scene ${item.ordinal}` : 'Section'}:{' '}
                  {excerpt(item.label)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Place
            <select
              aria-label="Move placement"
              disabled={!canMove}
              value={placement}
              onChange={(event) =>
                setPlacement(event.target.value as 'before' | 'after')
              }
            >
              <option value="before">Before</option>
              <option value="after">After</option>
            </select>
          </label>
          <button
            type="button"
            disabled={
              !canMove || !byId.has(selectedMove) || !byId.has(targetMove)
            }
            onClick={() =>
              onMove({ itemId: selectedMove, targetId: targetMove, placement })
            }
          >
            Preview move
          </button>
        </details>
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

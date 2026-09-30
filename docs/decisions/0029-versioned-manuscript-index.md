# 0029 — Versioned manuscript index and outline navigation

Status: Accepted direction, 2026-09-29. Scope: M4-03; [SPEC S04.2/S05.4/S08.3](../../SPEC.md#s04), NAV-01, EDIT-01, UX-03 and INV-03/10/11/14/18.

## Context and decision

Use one immutable advisory index of the existing exact source capture. The editor remains the only live author-content authority; the index never edits it or supplies a persistence acknowledgement. The WritingView capture boundary rechecks the originating boundary/session/version before admission. The controller also binds the originating session reference, version, immutable editor document and source SHA-256. Edits, Undo, import, restore and session replacement invalidate navigation immediately. A single deferred pending build coalesces admitted captures. Selection-only versions may reuse an index only when session, immutable document and hash agree. Disposal cancels pending publication.

An uncapturable accepted draft remains in the editor; earlier results are visibly unavailable/stale and inert. Oversized or unsupported-encoding projections fail as a whole. Source parsing/encoding stays in the existing deferred capture path; indexing does not parse again or run in a key handler/transaction filter. No worker, second editor engine, dependency, disk endpoint or native authority is added. Each capture boundary retains one previous branded content capture: exact immutable-document identity can reuse private source bytes, codec document and ranges, while version/Unicode selection and the source hash are derived anew. Foreign or changed documents and fabricated envelopes cannot reuse it. Weak branding does not retain every Undo generation.

Selection-only frames of an already projected session/document defer source derivation until after the selection/scroll handler and two animation frames. A 64 ms fallback after that handler keeps hidden/frozen captures live; ordinary capture retains the existing 32 ms fallback. Latest-state admission and exact receipts remain unchanged. This lets visible navigation finish before expensive recovery/source processing; it does not certify later main-thread, typing or long-session latency.

## Hierarchy and attachment policy

Ranges use zero-based physical row indices, half-open row/byte spans including retained original line endings. A scene ends immediately before the next scene heading **or any section heading**. A section includes its subordinate scenes/sections and ends before the next section whose authored nesting level is equal or shallower. Skipped levels are retained without invented sections. Scenes belong to the nearest open section. Ordinal counting is independent of authored scene numbers, including duplicates.

Synopsis belongs to the current scene, otherwise the nearest section; an unowned synopsis is ambiguous. Notes/blanks retain literal range ownership by that same preceding item. Notes/blanks immediately before a heading, through a contiguous notes/blanks run, additionally name the following heading as a candidate and are ambiguous. Leading/unowned and unclosed/ambiguous notes are ambiguous. These are advisory candidate facts for M4-05's explicit preview, never permission to move content automatically.

Title fields, entire hidden regions (including wrappers), raw rows and paired dual dialogue have intact spans. Dual members are paired once; incomplete pairs or pairs spanning owners are ambiguous. Multiline hidden regions stay whole even when per-row attachments differ. Unknown surrounding fragments are retained separately as raw logical text. Future moves must evaluate intact spans and attachment candidates together, not split a note based on a per-row annotation.

## Logical anchors and bounds

Logical locations retain physical row/ID, body/title/note/omitted/raw scope, original newline and UTF-16-to-source-byte runs. Complete known inline text decodes escaping/emphasis; incomplete syntax stays literal. Hidden locations exclude region wrappers, which remain in intact spans. Run joins use right affinity; the final offset uses the last content boundary. Unicode scalar splits refuse rather than round; combining boundaries are retained. Navigation adapts these locations to the current rich or literal editor row. Empty logical text is represented but has no invented byte anchor.

The complete index is bounded at 16 MiB, 50,000 physical lines, 10,000 headings, 64 actual nested sections, 100,000 logical locations and 200,000 mapping runs. Crossing a bound publishes no partial current index. The UI shows at most 1,000 expanded matching headings and explicitly identifies the count/limit; filtering the complete index can reach later headings. Heading/synopsis excerpts beyond 500 UTF-16 units say “abbreviated”; at most ten synopsis lines per item are shown with an explicit remainder. These display limits never truncate the source or complete index.

## Navigation and consequences

Native semantic lists and buttons support Tab/Enter and pointer navigation, collapse and synopsis/heading/number filtering. Filtering coalesces independently of source capture; matching ancestors remain visible and matching branches temporarily expand. Selection transactions carry `addToHistory: false`. After acceptance, editor focus/DOM selection are synchronized (also in a selectable read-only view), then a scroll-only transaction reveals the caret. The pinned view ignores scroll requests while DOM selection is outside the editor; native viewport geometry verifies the ordering. Admission rechecks session/version/document/row ID/scalar offsets, active composition and transaction acceptance. Read-only ownership can allow selection-only navigation; mutations and frozen-session selection remain refused. Navigation creates no authored Undo event or source edit.

The bounded frontend index can still block a frame while it builds; measurements must distinguish isolated V8 index construction from native capture/mount, event-to-animation-frame and compositor paint. Moving the existing derivation to a worker is deferred unless measured workloads justify it. Full source find, counts, title editing, moves and stored caret positions are separate tasks.

## Evidence still needed

[M4 evidence](../test-evidence/M4.md) records focused/shared and default-app native results. M4-05/07/09/13 must validate their move/find/diagnostic/count consumers against these anchors and bounds. M4-14/15 own broader accessibility/integration and separate review. M6 owns full S13 page calibration/compositor paint, long-session heap/DOM and other-platform/installed/offline/adoption acceptance; C1 and dependency concerns remain open.

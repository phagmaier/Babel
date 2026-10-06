# UX and accessibility

Status: M4-03 versioned outline over M4-02 Home workflows, the M3 protected writing lifecycle and M4-01 native recents. [SPEC S08/S14](../SPEC.md#s08); APP-02, NAV-01–03, UX-01–03, SEC-01, INV-10.

The default native home offers New, Open Fountain and local recovery review, including explicit Resume as new draft. The browser preview reports native unavailability. Home presents M4-01 native recents, metadata-only Remove, Refresh and explicit Locate/link/different choices. New/Open and recovery remain distinct. Remove from Recents cannot delete source. Project creation asks for a destination or explicitly creates a recoverable unsaved draft.

The future writing view is continuous, with title, optional scene/section outline, element picker, writing area, and status. Status must distinguish live dirty version, recovery protection, source-file saved version, page-count freshness, and remote last-check state. Never infer "saved" or "up to date" from a queued job or old check. Search includes hidden author text with explicit filters; replace-all and scene moves are reversible, have keyboard equivalents, and preserve structure. Script Check is a separate, non-destructive panel. Read-only PDF preview is the printed-page authority.

Local v1 includes light/dark, focus, zoom, typewriter scroll, offline spellcheck, character focus/list, title-page UI, counts with inclusion rules, recent position, and a command palette. Use semantic controls, focus visibility, sufficient contrast, reduced-motion behavior, keyboard reachability, and native tests for IME, dead keys, scaling, clipboard, and close flows. M0 visual inspection is recorded in [evidence](test-evidence/M0.md); it cannot establish the future UX contract.

## Historical subsystem increments

The following notes describe the bounded state when each subsystem landed.
Current production wiring and its remaining limits are described below.

M2-05A adds startup checkpoint summaries, damaged/pending/conflicting material
notices, text/hex previews, Refresh and Inspect Later. Content is rendered as
literal text, with truncated display explicitly labeled. Failure never exposes
arbitrary transport text or claims an empty successful scan. Deferral does not
resolve/delete the case, and previews do not restore/save a screenplay. Explain
that these local checkpoints are not a separate disk backup.

M2-05B adds the headless choice contracts and a `RecoveryChoicePanel` with
comparison facts, fixed transaction/source wording, an explicit new-version
input and Recover/Keep/Copy/Resolve actions guarded against stale results;
adoption stays disabled on divergence, stale comparisons or stuck
transactions, with only the emergency copy available then. No source is
natively selected in this build, so New/Open remain disabled and the startup
review says so explicitly. [ADR 0017](decisions/0017-explicit-recovery-choices.md).
Production picker wiring and managed-project discovery remain later tasks.
New/Open remain disabled. [ADR 0016](decisions/0016-read-only-startup-recovery-review.md).

M2-05C provides a `SnapshotPanel` for a natively opened registration. It shows
named versions, the retention/cap policy and interrupted-material notices.
Actions require a name for an explicit snapshot and a strictly newer version for restore.
Native restore protects current live/disk bytes before replacement. Snapshot,
copy and source receipts have distinct wording; stale results cannot publish a
restore after the document or destination changes. Failed transport text stays
hidden behind fixed messages. Names render as literal text, with keyboard labels
and visible focus on inputs. Low-space/cap/attention failures retain protected
versions and ordinary source/recovery status.

Copies require an explicit native-selected destination token. Same-filesystem
wording states that losing the backing disk loses the copy; different-filesystem
wording says the physical disk is unverified. No automatic backup success or
alternate location is inferred. Production WritingView mounts the snapshot panel and native picker through the
protected writing session. AUDIT-SLP-B retired the old snapshot proof page;
M6-03 still owns independent production-native copy/prune retention audits.
M2-06 owns curated history protection.

M2-05D adds an injected `ProtectedClosePanel` and a synthetic native editor
close flow. Close failure remains visible with Retry, Save Emergency Copy and
explicit risk. When both normal and recovery storage fail, it states that newer
changes exist only in memory. An unsaved draft closes after a fresh recovery
receipt with recovery-only wording. The source is never labeled saved from a
checkpoint or backup copy. Production editor/picker wiring and full keyboard,
screenreader and installed-app close review remain open.

M3-06 adds reusable semantic [writing controls](../src/app/EditorControls.tsx): a caret/Mixed Element select, contextual Tab guidance with an F6 escape, a command/help list, and local shortcut settings. Menu/help labels and availability come from one registry. Settings support remap, unassign and restore defaults, show duplicate/reserved/storage failures, and report local preference success only after storing it. Commands awaiting later milestones stay disabled with an explicit explanation. The controls are mounted only in the synthetic native diagnostic until M3-12 activates production writing. Native keyboard/type-ahead, source/undo, remap/reload and focus evidence is in [M3-06](test-evidence/M3.md#m3-06--element-picker-and-configurable-shortcut-registry); screenreader and full platform coverage remain open.

M3-07 adds an anchored local [completion listbox](../src/app/CompletionPopup.ts). Up/Down navigate, Enter/Tab accept, Escape dismisses and a left mouse click retains the writing caret. Prefix/location/time segments and cue extensions remain separate. Suggestions render literal text and cannot insert by timing. [M3-07 evidence](test-evidence/M3.md#m3-07--local-character-and-heading-completion) covers real WebKit keys, actual pointer acceptance and app-only visual inspection; composition checks remain synthetic and screenreader coverage remains open. Production writing activation is still M3-12.

M3-08 adds a staged [Import Fountain panel](../src/app/FountainImportPanel.ts) with a labelled text area, explicit whole-screenplay replacement wording, native pre-import protection and Undo explanation. Staged text stays visible after success/failure. Status distinguishes import protection from source saving; arbitrary native transport details stay behind a fixed refusal. M3-12 mounts it in the production writing session. Registry menu/help actions now include bold/italic/underline. [M3-08 evidence](test-evidence/M3.md#m3-08--paste-formatting-and-native-input) records passing real pinyin/mozc IME commit/cancel/Enter; full paint/performance/accessibility gates remain later.

## M3-12 production writing lifecycle

The default native app now offers New recoverable draft and Open Fountain.
One writing session connects editor, source Save, native Save As, Fountain copy,
recovery choices, snapshots and protected close. The browser preview has no
native services. Home/recents now land in M4-02; navigation, title-page form and other M4 features
remain open.

F6 leaves the editor for enabled screenplay actions, and ordinary Tab navigates
controls. The protected close panel focuses Retry. Read-only native ownership
refuses editing commands as well as typed input. Save/Open commands and help use
the same locally remappable registry. Open while writing first passes protected
close; native window close follows the same policy.

Recovery/source/snapshot/history facts remain distinct. Cadence receipts update
status without another keystroke. Older-session recovery is discoverable after
open/restart and requires an explicit content choice; the editor allocates a
newer version without choosing content. Restore/recovery protect the current
live draft first and create an Undo boundary. Native versions are coordinated
automatically; production choices do not ask the writer to enter version numbers.
Staged import text survives ordinary source saves.

Source failure and divergence remain visible. Failed close preserves retry,
native emergency-copy selection and explicit risk choices; changing the draft
invalidates old risk acceptance. A verified copy never marks the source saved.
Native default-build and injected UI evidence is linked from
[M3-12](test-evidence/M3.md#m3-12--production-writing-lifecycle-and-failure-ui).

The [M3-13 review](archive/reviews/2026-09-29-m3-13-review.md) identified stale protection facts, uncapturable-draft copy refusal, unsaved restart recovery without a resume route, and read-only Save As refusal. The [audit corrections](test-evidence/M3.md#repository-audit-corrections) add immediate live-version status, an explicitly labeled draft bundle when Fountain capture fails, Resume as new draft with original checkpoints retained, and native Save As from read-only views. Their bounded validation is recorded separately from the original review. An independent integrated exit review remains required.

## M4-02 Home, entry and recovery

Home reads recent metadata and local recovery asynchronously; pending/failed
recents never prevent New/Open. It does not scan manuscripts for titles, page
counts or remote state. Filename fallback titles are literal and native-bounded; last known local modification is shown from native metadata. Missing
entries disable Open and expose Locate; unknown availability allows native
revalidation. Refresh retires prior comparisons. Locate opens a native picker,
then shows identity and last-known-byte comparison separately. Link moved is
explicit and unavailable when native checks refuse it; Open as different retains
the prior entry/recovery and can open read-only. Cancel changes no mapping.
Remove deletes auxiliary metadata only, with retained-source/recovery wording.
Failures show fixed messages, never arbitrary native transport text.

New screenplay explicitly creates an unsaved draft and immediately attempts a
confirmed local checkpoint, including for an empty draft. New with destination
uses the same draft protection and native Save As publication. Cancellation or
failure leaves that draft open with truthful recovery/source wording and retry
controls; a checkpoint is never labeled a source save or separate backup.
Opening controls wait for initial capture/protection to settle. Source-ownership
refusal opens read-only and points to Save As for a writable copy.

Home in the writing actions invokes existing protected close and lease release.
The header shows the receipt-derived save status, with version/recovery/source/
snapshot facts under Save details. Snapshot attention and changes only in memory
remain visible alerts. File-backed/read-only Close session, Home/Open and native
window close automatically attempt the protected close. Untitled drafts ask
before recovery-only close; Keep writing dismisses the prompt and allows Save As.
Only completed release returns to Home; source/recovery/lease failure preserves
the editor and retry/copy/risk controls. Open while writing keeps the same close
gate. Home entry choices are serialized by the mounted route; stale native opens
release their returned registration instead of switching a newer session. Late
catalog, locate and recovery inspection responses cannot update a retired Home.
New/Open/Recent/Locate/Remove/confirmation use semantic buttons and visible focus;
Home starts focus at New. F6 prefers the enabled writing save action, falling
back to the first enabled screenplay action when Save is unavailable.

Recovery remains an explicit full-byte native choice. The displayed preview is
bounded, while Resume revalidates and checkpoints the complete selected bytes
under a fresh identity, retaining the original. Selected source recovery keeps
Restore recovered draft, Keep saved file and Save Recovered Copy. Native open
reconciles only clean identical latest content or an exact verified Keep marker
under exclusive ownership and safe transaction guards. Discovery finishes before
editing; unresolved recovery shows one plain primary choice, with older records
behind Inspect. Inspect later permits read-only navigation; title, spelling,
find/move and Import authorship stay gated as well. Successful choice returns
focus through the owned editor view with its selection retained. Interrupted saves and
malformed/missing-source emergency copies remain available. No automatic adoption
or journal retirement. [AUDIT-D02 brief](archive/tasks/AUDIT-D02.md) owns this amendment;
its evidence preserves the historical explicit-choice checks. Native tmpfs/Btrfs and injected
UI coverage, actual warm Home observations and accessibility limits live in
[M4-02 evidence](test-evidence/M4.md#m4-02--home-and-recovery-workflows).

## M4-03 outline

Writing exposes a nested collapsible Outline with heading/synopsis/authored-number filtering. Scenes display their sequential ordinal separately from authored numbers, including duplicates; sections keep authored nesting and synopsis. A matching descendant includes its ancestors and temporarily expands that path. Buttons support Tab/Enter and pointer activation, return focus to the exact editor row and do not add an authored Undo step. Read-only manuscripts allow safe selection navigation; composition and frozen protection refuse navigation.

Pending or unavailable captures leave earlier headings visibly stale and disabled. Empty/no-scene drafts remain usable. The complete index is bounded; oversize/unsupported content gets no partial current projection. Rendering the first 1,000 expanded matches explicitly states the count and invites collapse/filtering; long heading/synopsis excerpts and synopsis-line remainders are disclosed. Navigate to the retained editor content to read the full text. [ADR 0029](decisions/0029-versioned-manuscript-index.md) defines these view limits; M4-05 implements reviewed moves; full source find and position persistence remain separate tasks.

## M4-04 protected workflow contract

Before a scene/section move of at least 50 physical source rows or 16,384 source bytes (including all attached rows/newlines), protect the exact live draft in both recovery and a verified safety revision. Count the entire moved section subtree. Unknown dimensions require protection. M4-05 supplies the reviewed move controls and transactions. The frozen session checks document, version, selection and composition after protection and immediately before dispatch. Cancellation, stale results, uncapturable drafts or history failure leave content intact with a retry/Undo/Save/copy action. Production Fountain import now uses this guard and exposes Cancel import protection; a started native checkpoint may finish while application is cancelled. Staged text stays present, Undo restores the previous source, and thaw restores ordinary cadence. [ADR 0030](decisions/0030-version-bound-workflow-protection.md).

## M4-05 move review

Drag a heading’s handle onto another heading to preview placement before it. Up/down buttons offer keyboard/Enter equivalents; the keyboard destination controls also provide explicit Before/After and cross-section scene placement. Section destinations keep the same nesting level/parent and carry the entire subtree. Destination controls expose at most 1,000 matching headings with a disclosed filter route to later items. A drop from another document/panel, or a stale drag, is inert.

Every move previews the exact moved source, row/byte dimensions and ambiguous attachments that move or stay. Original/candidate byte copies stay in the preview with full read-only text; source-file Save/copy continues through the existing native services. Apply is disabled on refusal or after a version/selection change; Cancel permits a new preview. A large move announces recovery/safety protection and offers Cancel move protection; input remains frozen until the native worker settles. Failure leaves the preview and current source available for review, retry, Save or copy. Successful moves focus/reveal the followed selection, and one Undo restores source/selection. [M4-05 evidence](test-evidence/M4.md#m4-05--reversible-scene-and-section-moves).

## M4-06 title-page form

The Title page action opens ordered fields with literal Fountain emphasis, unknown-field labels and separately numbered duplicate keys. Each field has explicit Edit/Remove/Move up/Move down controls; Add offers standard key suggestions while retaining custom keys. Field value accepts continuation lines and empty values, with visible refusal for content Fountain cannot represent faithfully. Apply commits one undoable edit; Discard drops only staged form input. Uncommitted input is clearly labeled as neither saved nor recovery-protected and blocks leaving, source saving and replacement workflows until resolved. Input shortcuts/IME remain local; keyboard Edit focuses the key, Escape closes a clean form and close returns focus to the title-page action. Read-only sessions allow inspection. [M4-06 evidence](test-evidence/M4.md#m4-06--source-preserving-title-page-form) records bounded Linux keyboard/IME/focus/failure coverage; full assistive-technology coverage remains M4-14/15.

## Find and hidden text (M4-07)

Find opens a local query with full-script default, exact current count, Previous/Next, wrap status, case/Unicode whole-word controls and independent title/note/omitted/raw filters. Current scene follows the editor caret using the outline's scene boundaries; outside a scene it explains the unavailable scope. Results label source row and scope; title results also identify the field key, and uncertain protected text is labeled literal. Navigation selects and scrolls the retained editor text, including title/hidden targets, without opening a second editing form. Protected source stays read-only. Enter/Shift+Enter navigate, Escape closes to the current editor caret, and IME input stays local. Earlier/stale/uncapturable and oversized result sets cannot navigate; visible caps disclose excerpts and complete bounded counts. [Editor behavior](editor-behavior.md#logical-find-m4-07) documents exact inclusion/boundary rules; broader accessibility remains M4-14/15.

## Transactional replace (M4-08)

The find panel previews replacement against current results before anything changes: an exact replaceable count, excluded matches grouped by retained-content reason, and an explicit confirmation step for replace-all at or above 100 editable matches. Replace match commits the active result and advances to the following match with editor focus; Replace all commits every replaceable match in one step with one Undo. Invalid replacements, stale/changed queries and versions, and read-only, composing or staged-title states refuse with text and selection retained; title matches direct the author to the Title page form instead. Completion, outline and diagnostics refresh from the new version through the existing capture path. [Editor behavior](editor-behavior.md#transactional-replace-m4-08) owns planning/Undo/caret rules; [M4-08 evidence](test-evidence/M4.md#m4-08--transactional-replace-one-and-replace-all) records bounded Linux preview/keyboard/Undo/Save/reopen coverage.

## Script Check (M4-09)

The Script Check toolbar action opens grouped warnings and dismissible advisories with exact counts, severity filters and per-issue Go to Issue navigation that selects and reveals the affected block without changing it. Stale results stay visible but cannot navigate until refreshed; export assessment is always labeled unavailable until the M5 renderer connects. Running the check never mutates source or blocks saving. [Editor behavior](editor-behavior.md#script-check-diagnostics-m4-09) owns currency/navigation rules and the [validation contract](screenplay-validation.md#m4-09-rule-catalog-and-boundaries) owns the rule catalog; [M4-09 evidence](test-evidence/M4.md#m4-09--non-destructive-script-check-and-issue-navigation) records bounded Linux coverage.

## Presentation modes (M4-10)

Home and writing share explicit System/Light/Dark themes. Writing offers 75–200% bounded zoom, Focus mode and Typewriter scroll in a sticky semantic toolbar. Zoom changes writing font size only. Focus hides the heading, outline, advanced editing controls and secondary screenplay actions; Save, the toolbar exit and protection status stay available. Escape exits focus unless composition, a form input, completion or an open workflow owns Escape. F6 and remappable registry Focus Mode remain keyboard routes. Open panels and recovery/snapshot failures remain mounted; protection status and preference errors stay visible in the header during scrolling.

Settings contain only versioned UI configuration. Corrupt/unavailable reads disclose defaults without erasing stored data; failed writes disclose failure and retain working settings. No manuscript protection follows from storing preferences. Typewriter follows intended typing or caret-arrow input after paint, without animating scroll. Manual wheel/touch/pointer scrolling cancels follow until subsequent editing input. Composition, selection ranges, Home/End/Page keys, find/check/outline jumps, modal workflows and loss of editor focus suppress it. The lower writing padding lets the final line reach the viewport center; it carries no page-count meaning. Reduced motion uses instant scroll, status text carries meaning without color, and light/dark/forced-color focus borders use scoped theme tokens. [M4-10 evidence](test-evidence/M4.md#m4-10--presentation-modes) owns bounded Linux verification and limits.

## Screenplay element layout (AUDIT-D03A)

The writing column is at most 60 characters wide and centred. Inside it, character cues start 22 characters in; dialogue starts 10 in and is 35 wide; parentheticals start 16 in and are 30 wide; transitions are right-aligned and centered text is centred. These are the frozen `us-letter-draft-v1` proportions expressed as fractions of the column, so at high zoom or in a narrow window the column and every indent shrink together instead of overflowing. Scene headings, action and all other kinds use the full column. Dual dialogue is shown as consecutive single-column speeches.

The layout is CSS over the existing `data-kind` attribute. Displayed text is always the source text: no uppercasing, generated labels or hidden markers. Editor wrapping uses the UI monospace font and is not the PDF's wrapping; page count and breaks come only from the PDF preview. The writing view's intended 920px shell width now takes effect (a later-loaded `.shell` rule had held it at 680px). [Evidence](test-evidence/AUDIT.md#audit-d03a--on-screen-screenplay-element-styling) separates the Chromium geometry check from native WebKit runs.

## Writing layout shell (AUDIT-D03B)

In a window at least 1100px wide the writing view is three columns under the sticky header. The navigator (Characters and counts, then Outline) is pinned on the left and the script column holds the heading, actions, element picker, recovery/export/preview panels, editor, close prompt and snapshots. Spellcheck, Script Check, Find and Title page open in a tools drawer pinned on the right; the drawer exists only while one of them is open. The window scrolls the script; each side column scrolls on its own when taller than the window. Narrower windows keep the earlier single-column stack.

Keyboard and reading order did not change: actions, tool panels, navigator, editor, then close/snapshots. The wrappers are plain containers, so the landmarks remain the panels themselves, and the editor is never remounted when panels open or close. Focus mode hides the navigator and the same heading and secondary controls as before. Status, alerts and Save details share one wrapping header row, so the "only in memory" alert that comes and goes while typing no longer changes the header height and moves the script on a wide window; a long error can still wrap and grow the header. The actions area above the editor is unchanged and still tall. [Evidence](test-evidence/AUDIT.md#audit-d03b--writing-layout-shell) separates mounted, Chromium and native WebKit checks.

## Offline spellcheck proof (M4-11)

[ADR 0032](decisions/0032-linux-native-spellcheck.md) selects the tested native Linux WebKitGTK/Enchant/Hunspell path for M4-12. The isolated proof verified explicit correction/Undo, language/resource failure, names, selected-word Ignore/Learn, Unicode and real IME. Ignore is session-only; Learn survives restart in an application-scoped disposable dictionary. Language choice is application-wide, and continuous-check Off alone does not suppress native menu suggestions. View-only name suppression passed without editing source. Production controls, resource discovery, persistent preferences, dictionary-write failures and native keyboard menu accessibility remain M4-12; no default-app spellcheck activation is claimed here. Other platforms and installed packaging remain open. [Evidence](test-evidence/M4.md#m4-11--offline-spellcheck-proof).

## Production offline spellcheck (M4-12)

The default Linux writing screen offers **Spellcheck → Check spelling** and an
application-wide installed-language selector/Enable control. Checking is explicit;
edits or caret changes clear old results. The panel underlines possible issues,
then **Review** offers bounded local suggestions, **Ignore this session**, or
**Add to local dictionary**. Corrections are explicit editor transactions; one
Undo restores text, emphasis and the previous selection. Mixed-emphasis words
require direct editing. Composition, read-only manuscripts and protected workflows
cannot accept corrections. Failure messages remain in the panel; writing/saving
stay independent.

Ignore lasts for the application process and language. Add is confirmed only after
application-owned local storage is synced; it survives restart for that language.
Names derived from editable Character cues (excluding extensions) are skipped
case-insensitively as individual name tokens in this manuscript without dictionary
pollution. Title, notes, omitted/raw/protected regions are excluded. The panel
states its 32768-word/200-visible-issue limits and unsupported/oversized skips.
Off suppresses checking and native spelling menus. The platform personal dictionary
is neither learned into nor used; no text is uploaded. Missing dictionaries have
a usable unavailable state. [ADR 0033](decisions/0033-production-spellcheck-boundary.md)
owns boundaries/resources and [M4-12 evidence](test-evidence/M4.md#m4-12--production-offline-spellcheck)
owns measured coverage. Other languages/platforms, installed packages, broader
accessibility and large-script/long-session costs remain open.

## Characters, counts and recent position (M4-13)

Writing exposes exact-spelling Character focus, optional Highlight dialogue and
Next character cue with wrap to the first cue. Native select/checkbox/button
controls are keyboard reachable; successful navigation returns the editor caret
without authored Undo. Focus mode hides the secondary panel. Counts show their
version and separate title/note/omitted/raw/outline totals, with expandable
[inclusion rules](document-model.md#character-and-count-projection-m4-13).
Earlier facts are explicitly stale and cannot navigate. Character highlights use
an independent view-only decoration source alongside Find/Check/spelling.

Ordinary Open/Recent may restore a matching local caret and independently scrolled
viewport. New/Locate/recovery/replacement/Save As use their existing selection
contracts; a copy does not inherit another document's position hint. Source hash,
persistent native identity, row bounds and Unicode scalar boundaries are required.
Exact recovery selection takes priority. Opening and thawing a replaced Save As
view synchronize the DOM caret with the owned editor selection without an
authored transaction. Input cancels deferred viewport restoration;
manual scrolling stays independent of typewriter follow. An auxiliary failure notice
never blocks Save or Close. [ADR 0022](decisions/0022-local-shortcut-preferences.md#m4-13-recent-position-hints)
owns the minimal UI-only storage and fallback policy. Installed-package retention,
other platforms and assistive-technology acceptance remain open.

## M4-14 palette, native menus and keyboard integration

Home and writing expose Command Palette (`Mod+Shift+P`, remappable). It filters
currently enabled actions and writing scenes/sections. Up/Down selects, Enter
activates once, Escape/F6 cancels to the prior control/caret, and Tab/Shift+Tab
stays inside the semantic modal dialog. Background controls are inert. Navigation
uses the displayed version/hash/session projection and refuses stale frames;
100 visible results are capped explicitly, with filtering across the full list.
The sole editor is labelled “Screenplay text,” a multiline textbox. F6 cycles
from writing to screenplay actions and back; ordinary controls retain native Tab.
IME/composition and form typing/Undo own their keys. Status/errors remain visible,
selected palette rows have a glyph/outline as well as weight, and shared theme,
forced-color focus, reduced-motion and narrow-window styles apply.

Native Screenplay/Edit/Navigate/Tools menus read the same command catalog and
live registry preferences as help and palette. Shortcut hints update after a
successful remap; keyboard routing remains in the WebView to respect form/IME
ownership. Menu clicks emit strict token-bound command IDs and recheck current
availability before using the existing entry/save/protected-close/editing services.
Read-only and busy/staged/composing states refuse unsafe actions; unimplemented
PDF, revision timeline and remote workflows remain visibly disabled with milestone
reasons. Native menu failure leaves visible controls/palette available and reports
a fixed notice, without changing saving/recovery status.

[M4-14 evidence](test-evidence/M4.md#m4-14--palette-menus-and-accessibility)
distinguishes contract/DOM, real Linux menu/keyboard/IME/scaling, and actual
assistive-technology inspection. No screenreader or broader platform acceptance
is implied by semantic labels or native tree exposure. M4-15 integrated review
and installed-profile/full accessibility/performance gates remain separate.

## PDF preview (M5-05)

The writing toolbar opens a separate **Read-only PDF preview** and reports
current captured version/page count only after the exact PDF displays and its
parsed count matches the native receipt. Opening focuses Close; Escape or Close
returns to the toolbar. Previous/Next and zoom controls are keyboard accessible;
page text is selectable in a read-only disclosure. Printed paper stays white in
both themes and preview zoom does not change export typography.

Typing, Undo, source/session replacement and selection-version changes show
**Updating** immediately. Earlier pages retain a captured-version/stale label.
Failure explicitly leaves editing and Save available; Refresh retries. Closing
cancels work and clears count. Renderer limitations stay visible, and a preview
is not an export-success receipt. [PDF contract](pdf-and-formatting.md#authoritative-preview-m5-05)
and [evidence](test-evidence/M5.md#m5-05--authoritative-preview-and-page-count-freshness).

# ADR 0033 — Explicit offline spelling and durable local vocabulary

Status: Accepted direction; Accepted for the provisional Linux implementation. Date: 2026-09-30.
Authority: [M4-12](../tasks/M4-12.md), [ADR 0032](0032-linux-native-spellcheck.md),
SPEC S08.5/S13/S14, UX-02, INV-01/03/11/14/16/17/18.

## Decision and reason

Use the same Enchant 2 / Hunspell provider proven in M4-11, through one typed
native `spellcheck` command. WebKit's native Learn has no durable-write receipt,
and native menu corrections cannot enforce the application's exact version and
workflow guards. The sole editor therefore sets `spellcheck=false`; Babel's
keyboard-accessible panel performs explicit checks and corrections. This is one
local backend, not an additional engine or an online grammar service.

The narrow [ABI adapter](../../src-tauri/src/enchant.rs) links the existing
system `libenchant-2` ABI, selects Hunspell and verifies the loaded provider/tag.
Broker lifetimes are serialized process-wide: concurrent initialization/teardown
failed during actual native tests before serialization. Pointers remain on one
worker, with dictionaries/lists freed before their broker. There is no new
Cargo/npm runtime dependency. The build-only version check is described below.
System dictionaries remain installation
prerequisites, with visible unavailable-language/resource states.

Request dictionaries with an explicit empty `/dev/null` personal wordlist.
This refines ADR 0032's proposed `ENCHANT_CONFIG_DIR` approach: Enchant's
[2.8.21 source](https://github.com/rrthomas/enchant/blob/v2.8.21/lib/dict.vala)
shows that an explicit PWL bypasses the ordinary personal/exclusion wordlists
and their implicit directory creation. No native Learn/add/replacement-writing
API is used. No process environment mutation after toolkit/thread startup or
ordinary global personal dictionary modification is needed. Provider ordering
may be read by Enchant, but a loaded provider other than Hunspell is refused.

Build prerequisite clarified 2026-10-03 ([AUDIT-W0-R1](../tasks/AUDIT-W0-R1.md)):
the explicit-PWL API was introduced in Enchant **2.4.0**, per
[upstream NEWS](https://github.com/rrthomas/enchant/blob/v2.8.21/NEWS).
Linux builds now check that minimum with pinned `pkg-config` 0.3.34 (build-only,
MIT OR Apache-2.0). Ubuntu 24.04 CI's Enchant 2.3.3 cannot provide the required
isolation API. CI builds the same 2.8.21 as the verified host from a SHA-256-pinned
release into a temporary prefix with Hunspell and probes its actual empty-PWL
behavior before the workspace suite. This clarifies the existing system ABI
contract; it does not introduce an older-API fallback, app environment mutation,
additional engine, or an installed/runtime distribution acceptance claim.

## Ownership and durability

Application-wide language/Off preferences and explicit added words live only in
the private app-data store. Words are scoped to language and matched by Unicode
lowercase without normalization/fuzzy identity merging. Ignore is a separate
bounded process-session set; language changes preserve each language's entries,
and application restart clears Ignore. Character cue tokens, excluding cue
extensions and hidden/protected rows, are skipped case-insensitively for the
current manuscript; deriving names never writes a dictionary.

The [dictionary publication adapter](../../crates/screenwriter-core/src/documents/spellcheck_store.rs)
reuses the existing descriptor-relative private-file, store-identity and stable
lease primitives. Two checksummed generations preserve the previous valid
vocabulary; create-exclusive pending writes are synced, independently reread,
renamed and directory-synced before Add acknowledgement. Failed/interrupted
artifacts remain; bad state blocks mutation, and a surviving prior valid slot
can supply vocabulary with an attention status. No valid state plus corrupt
existing metadata refuses rather than resets. Generation comparison prevents
lost updates; duplicate Add is idempotent. Dictionary work has its own worker
mutex/queue and never holds the manuscript persistence mutex.

Native commands reject unknown fields, paths, malformed languages/words and
oversized queues/entries. Bounds: two native jobs, 128 words/job, 128 UTF-8
bytes/word, 32-byte language tags, 128 enumerated languages, eight suggestions,
2048 added/ignored entries and 1 MiB serialized metadata. Language selection
reports actual loaded resources; unavailable choices never fall back silently.

## Editor and interface policy

Check spelling is explicit and deferred from typing. One panel job checks up to
32768 eligible words in batches, showing at most 200 issue ranges and stating
limits/skips. Title, notes, boneyards and raw/protected rows are excluded. Words
use Unicode letters/numbers and internal apostrophes/hyphens; supported combining
marks are U+0300–036F. Unsupported or oversized tokens are reported as skipped.
No automatic document rewrite or unsupported whole-script clean claim.

The immutable scan binds document/session/editor version and exact ranges. Any
content or selection change invalidates suggestions/decorations. Corrections
reject composition, read-only state, frozen workflows, staged title input,
foreign/stale ranges, protected rows and invalid Unicode. A uniform-mark word
retains its marks; mixed emphasis requires direct editing and explains why.
Trial application/capture verifies Fountain representability before one isolated
editor history transaction. One Undo restores the previous text/marks/selection.
Dictionary operations and view-only highlights create no author-content history.

## Resources and evidence still needed

[M4-12 evidence](../test-evidence/M4.md#m4-12--production-offline-spellcheck)
owns actual native/default-release/filesystem results. Enchant 2.8.21 is
LGPL-2.1-or-later; Hunspell 1.7.4 on the M4-12 host is LGPL-2.1-or-later OR GPL-2.0-or-later OR
MPL-1.1. Host English dictionary/resource hashes and package license obligations
remain as recorded in ADR 0032. The new direct system ABI dependency requires
Enchant development/linker files to build and its runtime library/provider and
language resources to run. Full notices, installed/offline package validation,
other platforms/languages, long-session costs, broad assistive technology and
M4-15 integration review remain open. No full S13 or Local v1 adoption claim.

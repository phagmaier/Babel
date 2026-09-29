# Local history and explicit remote transfer

Status: M2-06 Linux headless history primitives implemented after the M1-05 proof; production history UI/cadence and remote adapters remain planned. [SPEC S11](../SPEC.md#s11); HIST-01/02, SYNC-01–05, INV-07–09/15/20.

Local history will store curated Fountain/profile revisions through a native `HistoryStore`, independent of editor undo, recovery, current file, and backups. M1 tests a Git implementation on disposable repositories, including library/license/bundling behavior; the leading choice is now vendored git2 per [ADR 0011](decisions/0011-git2-history-store.md). Revisions are made periodically and before risky operations, not per keystroke. Restore creates a new revision after protecting current content; it never resets away later history. History failure must not block emergency source saving. No system Git installation is assumed for end users.

Remote M7 is manual: Upload Current Draft, Check Remote, Get Latest, Open from Remote. The app must use the same service from home/editor. A transfer captures an exact saved/checkpointed version and preserves local work before fetch or adoption, including home-screen operations. Fetch does not change the active source. Compare project identity and revision ancestry, not timestamps; preserve both heads on divergence and require explicit conflict review. Publication is non-force and no auto-merge is performed. An uncertain transfer result asks for a fresh check.

Private Git hosting is only a candidate. **Private hosting is access control, not end-to-end encryption.** The provider/authentication/privacy decision remains deferred. No real upload is allowed until the owner selects a destination and acknowledges whether provider-readable storage is acceptable; provider-blind storage requires a separate encrypted design. Credentials never enter Fountain, manifests, logs, URLs, or repository source. No auto-upload or runtime network dependency is configured. [ADR 0006](decisions/0006-explicit-remote-gate.md).

M1-05 [proof](../prototypes/history-store/README.md) records curated raw blobs/
manifest hashes, exclusive/CAS refs, new-child restore, preserved conflict refs
and two-client local bare transport. Fetch uses isolated incoming refs; push
uses an immutable capture and normal non-force refspec, checks per-ref status
and verifies the remote head. Source/recovery copies stay untouched on Git
failure. No authenticated provider or production durability is proved.
M2-06 promotes the pinned local `git2` adapter into `screenwriter-core`. It
uses private bare native app-data history repositories keyed by document UUID,
a project-bound marker, curated exact-byte source and portable profile/hash
manifest, checked first-parent/CAS main updates and explicit safety refs.
Native callers may record only the owned current disk generation or an exact
latest current-session recovery checkpoint. Changed source/profile content
creates a revision; unchanged content is deduplicated. Recovery adoption and
snapshot restore protect current content in a safety ref after independent
snapshot/checkpoint protection and before replacement. If history is corrupt
or publication fails, those destructive operations stop; ordinary saving and
recovery remain available. `HistoryHealth` exposes attention after restart.
The safety ref is a persistent operation record, but no Git object/ref power-loss
durability or multi-ref atomicity is claimed. No pruning, automatic repair,
production scheduler/UI or network transport exists. [ADR 0020](decisions/0020-native-curated-history.md)
owns the storage and failure choices; the [M2-06 report](test-evidence/M2-06.md)
records bounded native evidence. M6 owns the timeline, named UX, cadence and
restore workflow; M7 owns manual remote transfer.
[Gate review](m1-gate-review.md) records M1 exit and reviewed M2 contracts.

M3-08 exposes the narrow `protect_fountain_import` native operation: checkpoint the exact owned live editor version, then record its safety revision with the native profile and fixed label before editor replacement. History failure refuses import while preserving a completed checkpoint and the source file. It adds no path/transport endpoint and does not weaken emergency-save behavior. [ADR 0023](decisions/0023-protected-fountain-import.md), [M3-08 evidence](test-evidence/M3.md#m3-08--paste-formatting-and-native-input).

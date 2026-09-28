# Local history and explicit remote transfer

Status: M1-05 native history proof complete; production history and remote adapters remain planned. [SPEC S11](../SPEC.md#s11); HIST-01/02, SYNC-01–05, INV-07–09/15/20.

Local history will store curated Fountain/profile revisions through a native `HistoryStore`, independent of editor undo, recovery, current file, and backups. M1 tests a Git implementation on disposable repositories, including library/license/bundling behavior; the leading choice is now vendored git2 per [ADR 0011](decisions/0011-git2-history-store.md). Revisions are made periodically and before risky operations, not per keystroke. Restore creates a new revision after protecting current content; it never resets away later history. History failure must not block emergency source saving. No system Git installation is assumed for end users.

Remote M7 is manual: Upload Current Draft, Check Remote, Get Latest, Open from Remote. The app must use the same service from home/editor. A transfer captures an exact saved/checkpointed version and preserves local work before fetch or adoption, including home-screen operations. Fetch does not change the active source. Compare project identity and revision ancestry, not timestamps; preserve both heads on divergence and require explicit conflict review. Publication is non-force and no auto-merge is performed. An uncertain transfer result asks for a fresh check.

Private Git hosting is only a candidate. **Private hosting is access control, not end-to-end encryption.** The provider/authentication/privacy decision remains deferred. No real upload is allowed until the owner selects a destination and acknowledges whether provider-readable storage is acceptable; provider-blind storage requires a separate encrypted design. Credentials never enter Fountain, manifests, logs, URLs, or repository source. No auto-upload or runtime network dependency is configured. [ADR 0006](decisions/0006-explicit-remote-gate.md).

M1-05 [proof](../prototypes/history-store/README.md) records curated raw blobs/
manifest hashes, exclusive/CAS refs, new-child restore, preserved conflict refs
and two-client local bare transport. Fetch uses isolated incoming refs; push
uses an immutable capture and normal non-force refspec, checks per-ref status
and verifies the remote head. Source/recovery copies stay untouched on Git
failure. No authenticated provider or production durability is proved.
M2-06 promotes only these small primitives behind the native coordinator and
adds interrupted-object/ref tests, durable operation records and retention
policy; it must never substitute Git for recovery or a source-save receipt.
[Gate review](m1-gate-review.md) records M1 exit and reviewed M2 contracts.

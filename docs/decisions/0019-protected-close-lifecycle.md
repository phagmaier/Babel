# ADR 0019 — Protected close and explicit risk relinquishment

Status: Accepted direction. Date: 2026-09-28. Task: M2-05D.
Authority: [SPEC S08.6/S10.2/S10.8](../../SPEC.md#s10), SAVE-05, INV-04/07/10;
[persistence](../persistence-and-recovery.md), [architecture](../architecture.md).
Evidence: [M2-05D report](../test-evidence/M2-05D.md).

## Decision

One editor authority synchronously freezes input before deriving an immutable
latest-version capture. `ProtectedClose` verifies the capture against the
controller's exact version/hash/length. A named source receives a fresh explicit
native save and only its exact source receipt allows ordinary release. An
unnamed draft receives a fresh recovery checkpoint; its close wording promises
recovery protection, not a source file. Source failure may earn an independent
recovery receipt, but remains a close failure. Source uncertainty/divergence
never retries against a guessed baseline; recovery can still be attempted.

After a failure the editor thaws and stays open. The persistent close panel
offers Retry, a natively selected Emergency Copy, and an explicit risk choice.
Copy receipts must match identity/session/version/hash/length and grant no source
or recovery credit. A copy failure leaves the document open. If source and
recovery fail, the panel states that newer changes exist only in memory. Risk
close needs a fresh checkbox choice; it makes no durability claim.

The Linux native service keeps ordinary `release` conservative when a source
transaction is uncertain. A distinct `release_at_risk` relinquishes only the
exact registration after the explicit risk or verified emergency-copy flow;
pending native writes still block it. Recovery/transaction artifacts stay for
startup inspection. The desktop uses bounded blocking workers for both release
commands. Tauri cancels an OS window close whenever a native registration is
open and emits `protected-close-requested`; the diagnostic editor routes it
through the same close coordinator. An uninitialized production host has no
registration and can close normally.

## Limits and evidence still needed

The native process cannot observe edits still confined to a frontend editor;
the editor owner must freeze and capture correctly. The default shell has no
production editor/picker/cadence, so the close panel is an integration contract
and the real WebKit drill uses a marked synthetic proof. This does not establish
Local v1 Save As, installed/offline behavior, other-platform window events,
actual disk-full or hardware power-loss guarantees. M2-06 owns curated history
failure isolation; M6 owns the production editor/picker and adoption drills.

## Alternatives and consequences

Automatic release after enqueue would discard unknown live edits and confuse
queued work with protection. A single implicit close command would hide whether
source, recovery or copy succeeded. The chosen flow keeps the editor authority
and explicit choices visible; it requires the future production editor to supply
a reliable synchronous freeze and latest-version capture. The native close guard
keeps a window open if event delivery fails, leaving a visible manual recovery
path rather than an unconfirmed release.

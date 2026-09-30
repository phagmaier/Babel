# ADR 0027 — Preserve uncapturable drafts with an explicit bundle

Status: Accepted direction. Date: 2026-09-29. Task: M3-12-R1. Authority: [SPEC S03/S05/S10](../../SPEC.md#s03). Related: [ADR 0021](0021-production-editor-source-captures.md), [ADR 0026](0026-writing-lifecycle.md).

## Decision

Every accepted editor transaction immediately advances the live protection version, independently of deferred capture success. Earlier receipts cannot claim that newer version saved or journaled. Fountain capture keeps its existing representability guards.

When explicit emergency copying cannot capture Fountain, the frozen EditorState produces a UTF-8 JSON artifact with schema `babel-draft-copy-v1`: exact original source in base64, live version, ordered rows with IDs, kinds, attributes and styled runs, and the current ProseMirror anchor/head selection. No source or live row is reconstructed from a truncated preview. The bundle is bounded to the existing 16 MiB copy payload limit; an oversized or failed copy keeps the editor open with a visible failure.

The existing native-selected copy capability publishes and verifies these bytes under a `.draft.json` name. The receipt binds identity, version, hash and byte length. A verified copy can authorize explicit close, but grants neither Fountain-save nor recovery-journal credit. This preserves the single editor authority and existing path-free native publication rules. The UI explains the artifact format before copying; this is an emergency preservation format, not a Fountain interchange or automatic bundle importer.

## Tradeoffs and evidence still needed

Base64 and JSON can exceed the bound sooner than ordinary Fountain. The artifact remains independently inspectable, including unsupported original bytes and currently unrepresentable live rows. Full bundle import/version migration is separately scoped. [M3 evidence](../test-evidence/M3.md) records contract, failure and native tmpfs/Btrfs publication checks; other platforms and hardware power-loss guarantees remain unverified.

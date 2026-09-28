# ADR 0006 — Explicit remote transfer and privacy gate

Status: Accepted sequencing/safety direction; provider and authentication deferred to M7. Date: 2026-09-27.

Context: [SPEC S11](../../SPEC.md#s11), SYNC-01–05, INV-07/09/15. Decision: remote transfer begins only after local safety; Upload and Get Latest are explicit and use save-before-fetch protection, ancestry checks, and non-force publication. Alternatives: automatic timestamp winner or silent merge are rejected. Consequences: no cloud account, credentials, or real upload in M0–M6. A private Git host is a candidate, not end-to-end encryption. The owner must acknowledge destination/privacy before first real transfer; provider-blind encryption requires a separate design.

Evidence still needed: M7 adapter decision, privacy-acknowledgement flow, and disposable-remote divergence tests.

# ADR 0001 — Local-first desktop stack

Status: Accepted direction; Accepted product direction; M0 host verification pending. Date: 2026-09-27.

Context: [SPEC S01/S03/S04](../../SPEC.md#s04), APP-01, SEC-01. The writer needs an installable offline desktop app. Decision: Tauri 2, React/TypeScript/Vite, and Rust, with one frontend package and small Rust workspace. No runtime service or account. Alternatives: browser-only delivery or a larger desktop runtime; neither is the selected product direction. Consequences: platform WebViews and native packaging need actual target-specific tests; a browser preview does not prove the desktop app. M0 pins toolchains. M1 must verify native input/performance, and later release gates must verify each declared OS.

Evidence still needed: M1-02 native input/performance proof; per-OS packaging verification at release gates.

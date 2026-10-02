# DEV-01 — laptop development setup

Status: complete; bounded Linux development readiness verified.

Owner requested development readiness after switching from desktop to laptop.
Base: `076f952`, clean `main`. No next-milestone feature implementation.

Deliverables: project-local Node/pnpm selection, installed locked dependencies,
Rust format/lint components, native Linux prerequisites, generated PDF helper,
inspection venv and compiled disposable input helpers; repeatable setup notes.

Setup exposed a helper identity portability defect: bytecode embedded build
paths, causing native renderer refusal. Canonicalize bytecode paths without
changing pinned inputs, renderer sources, fonts, profile or accepted goldens.
Update native/review identities only after independent exact golden comparison.
Limit test worker concurrency for laptop headroom; preserve isolation/timeouts.
Development StrictMode also exposed missing native event cleanup permission;
grant only event-unlisten alongside existing event-listen and verify real IPC.

Checks: full frontend/Rust gates, browser smoke, two-path offline build identity,
helper self-test/verifier, frozen-profile corpus, Tauri AppImage build, real
release WebKit publication IPC on tmpfs/Btrfs and packaged offline corpus.
Tier 3 packaging scope; omit unrelated full writing/IME matrices with rationale.
Use synthetic disposable files and profiles only. No push or manuscript access.

Evidence: [M5](../test-evidence/M5.md#dev-01--laptop-development-setup).
Next feature task remains M5-04.

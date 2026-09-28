# First Codex task: initialize the Screenwriter repository

> Status 2026-09-28: M0 is complete (see `docs/current-state.md` and
> `docs/test-evidence/M0.md`). Do not re-run this prompt. Later work starts
> from `TODO.md` and the current-state handoff, not from bootstrap.

You are working in the directory where I placed `SPEC.md`, `AGENTS.md`, and this `BOOTSTRAP_PROMPT.md`. Treat the specification as the authoritative product definition and the repository as durable project memory.

**Your task is to implement milestone M0 only: repository bootstrap and a verified, minimal desktop skeleton. Perform the work; do not return only a proposed plan. Stop before M1 investigations or application feature implementation.**

## 1. Inspect and read before modifying

Read `AGENTS.md`, then read the entire `SPEC.md` in manageable sections. Pay particular attention to S02-S04, S16-S20, and the boundary between accepted product direction and unproven implementation choices.

Inspect the current directory, repository status, and existing files. Preserve existing work. The expected starting point is a directory containing the three starter Markdown files, but do not assume it is empty or safe to overwrite. If an existing repository/project is present, adapt the setup without replacing unrelated files. Initialize a local Git repository only if none exists. Do not commit, push, publish, or configure a real remote during this task.

Check the actual host operating system, available package managers, Node, Rust/Cargo, and native Tauri prerequisites using the tools/permissions available. Record exact versions and limitations. The host is the provisional development platform; it is not proof of the user's complete target-platform list.

State a brief execution plan limited to M0. Do not ask the owner to repeat product decisions already present in the spec.

## 2. Establish the toolchain and build structure

Use the selected Tauri 2 + React + TypeScript + Rust direction. Start with one frontend package and a small Rust workspace containing the Tauri host and a headless `screenwriter-core` crate. Follow S17 unless the current official template requires a modest, documented adjustment.

Select compatible current stable versions from official documentation/the actual environment. Pin the package manager, Node compatibility, and Rust toolchain in repository-local files. Prefer pnpm for this new repo. Use real dependency resolution and generate genuine lockfiles; never fabricate or hand-invent lockfile contents. Do not rewrite global machine settings or install privileged OS packages without explicit approval.

If scaffolding tools would overwrite the three starter files or existing code, scaffold safely in a temporary location and merge only necessary files, or construct the minimal setup directly. Keep `SPEC.md` intact apart from an explicitly justified correction; do not replace it with an abbreviated generated spec.

Create strict TypeScript settings, a consistent formatter/linter, and Rust formatting/lint settings. Avoid unnecessary dependencies. Do not install a production PDF renderer, remote provider SDK, Git runtime, second editor framework, cloud service, or speculative database during M0.

Use a working application title of Screenwriter. Do not spend this task on branding, custom artwork, a complete theme system, or an app marketplace/distribution setup. Do not choose an open-source license for the owner's original application code without direction; track third-party dependency/license information separately.

## 3. Build only a minimal, truthful shell

Create a small React home-screen placeholder and a functioning Tauri host. Include an application heading, a clear "development skeleton" indication, and explanatory placeholders for New/Open/Recent if useful. Unimplemented actions must be disabled or explicitly unavailable; clicking one must not report a fake save, file open, or successful upload.

Create a harmless typed native app-info/health command returning real build/application information. Put any testable logic in the headless Rust core and keep Tauri command wiring thin. Use the minimum capabilities needed for the skeleton. Do not add generic filesystem or shell access.

Add only enough styling for a readable, keyboard-accessible shell. Do not build the screenplay editor or production document schema yet. Empty future directories are optional; avoid generating dozens of unimplemented service stubs.

A browser development preview is useful but is not the delivered desktop application. Keep mock platform adapters explicit, test/development-only, and separate from the native adapter. A browser cannot silently use fake persistence and call itself fully functional.

## 4. Establish real checks and a minimal CI path

Set up a TypeScript unit-test runner (Vitest is the preferred default), UI testing utilities where needed, Rust unit tests, and a minimal meaningful frontend/native-boundary smoke test. Test observable shell behavior or typed app-info behavior, not an unrelated `1 + 1` assertion. Do not write tests that certify product features which do not exist.

Choose one browser smoke approach and document the native smoke approach separately. Do not pretend a browser test with mocked Tauri calls exercises native IPC. Test the real native command/app start where the environment allows. If native automation requires further platform setup, record the blocker and the exact manual/native verification gate.

Define and document real commands for these purposes (these names are preferred, not a claim that they exist before you create them):

| Purpose | Preferred command/interface |
| --- | --- |
| Frontend development | `pnpm dev` |
| Desktop development | `pnpm tauri dev` |
| Formatting check | `pnpm format:check` |
| Frontend lint | `pnpm lint` |
| Type checking | `pnpm typecheck` |
| Non-watch frontend unit tests | `pnpm test` |
| Frontend production build | `pnpm build` |
| Aggregate frontend checks | `pnpm check` |
| Rust formatting | `cargo fmt --all -- --check` |
| Rust lint | `cargo clippy --workspace --all-targets -- -D warnings` |
| Rust tests | `cargo test --workspace` |
| Headless native-core tests | `cargo test -p screenwriter-core` |
| Desktop build/package | `pnpm tauri build`, with platform limitations documented |

Ensure scripts invoke genuine checks and propagate failures. If a named command is unsuitable, document the actual replacement consistently in the README, development docs, and CI. Do not leave commands that pass by doing nothing.

Add appropriate `.gitignore`, formatter exclusions, and newline controls. Exclude build artifacts, local logs, credentials, and runtime manuscript data. Preserve intentionally byte-sensitive Fountain fixtures: no automatic whitespace trimming or newline conversion of CRLF/BOM test inputs. The application source repository's Git configuration must not determine the runtime screenplay-history format accidentally.

Add a minimal CI workflow matching verified local commands and the documented environment. It must not publish releases, require paid services, read private credentials, or contact real manuscript remotes. A workflow file existing is not evidence it has run remotely. Native checks may need a separate lane from headless checks; label the distinction.

## 5. Generate focused repository documentation

Create `README.md`, `TODO.md`, and the focused documents in SPEC S17. They must be useful contracts, not empty headings or wholesale copies of SPEC. Each subsystem document should link its relevant specification sections/requirement IDs and state its current implementation status.

Required focused docs:

- `docs/index.md`, `docs/current-state.md`, and `docs/development.md`.
- `docs/architecture.md` and `docs/document-model.md`.
- `docs/editor-behavior.md`, `docs/ux.md`, and `docs/screenplay-validation.md`.
- `docs/persistence-and-recovery.md`, `docs/pdf-and-formatting.md`, and `docs/sync-and-versioning.md`.
- `docs/testing.md`, `docs/requirements.md`, and concise evidence under `docs/test-evidence/`.
- Short initial ADRs under `docs/decisions/`, following S19.

The architecture doc must identify actual module paths, frontend/native ownership, and how production features will fit without implementing them. Editor documentation must retain the smart Enter table, incomplete-state handling, autocomplete acceptance priority, undo, and IME expectations. Persistence/sync docs must preserve version-specific acknowledgements and save-before-fetch safety. PDF docs must keep the existing-renderer-first approach and label renderer selection as pending M1 proof.

Use explicit ADR statuses. The Tauri/Fountain/local-first direction is accepted; choosing a particular PDF engine or claiming a Git library is proven is not yet justified. The remote provider/authentication/privacy choice is deferred; do not select plaintext hosting on the user's behalf.

Keep root `AGENTS.md` short. The starter already contains the operating rules; update actual path/command references only as needed. Do not replace it with the full spec, a large change log, or all subsystem documentation. Avoid `AGENTS.override.md` or nested instruction files unless a real scoped need exists. Do not alter global Codex configuration.

The README must distinguish implemented M0 behavior from planned features, show verified setup/run/check commands, list exact known blockers, and explain that the app is not yet ready for important manuscripts.

## 6. Build the task and requirement structure

Generate `TODO.md` from S16 after actual paths and build commands exist. Use stable task IDs, dependencies, requirement IDs, docs-to-read, deliverables, acceptance criteria, and verification references. Record M0 tasks accurately. Do not check off unrun native checks.

Fully decompose M1 and M2 into coherent, testable tasks. Keep M3-M7 dependency-ordered with explicit milestone gates and scope, then require decomposition before implementation. Include planned M8 enhancements separately. Do not create hundreds of speculative tiny tasks or omit the planned remote extension merely because it is later.

Create `docs/requirements.md` mapping every requirement ID in S02 to its milestone, task or planned task group, and eventual test/evidence location. Unimplemented/unverified entries must say so. Mark planned test paths as planned, not existing.

Create `fixtures/README.md` with fixture conventions, provenance rules, and planned categories. Add only a few original seed text fixtures where useful; do not build the parser or expected PDFs to populate the folder. Do not copy the user's private screenplay or copyrighted scripts from the web.

## 7. Verify and review

Run the actual checks that the environment supports, including frontend formatting/lint/typecheck/tests/build and appropriate Rust checks. Attempt native startup/build according to available prerequisites and permissions. Inspect the shell visually where possible and record the platform/tool used.

If a check is blocked by missing dependencies, network restrictions, native libraries, or display access, record the exact command, observed error, and needed prerequisite. Continue independent safe work, but leave the blocked item open. Do not remove the check, fabricate a pass, widen permissions, or implement extra features to compensate.

Review your final diff for scope creep, overwritten starter requirements, secrets, personal data, fake-success stubs, unnecessary dependencies, broken doc links, and discrepancies between README commands and package/build configuration. Check that native test hooks cannot accidentally ship enabled.

Record evidence in a compact M0 report. Keep large logs outside the routinely loaded documentation and identify them by path when useful.

## 8. Write the handoff and stop

Update `docs/current-state.md` with the current milestone, completed/incomplete M0 tasks, actual paths, exact checks and statuses, environment blockers, decisions still requiring M1 evidence, and the first safe next task. Keep it roughly under 120 lines.

Finish with a concise report containing:

1. What was created and what actually runs.
2. The commands I can use to start the frontend and desktop app.
3. Checks that passed, failed, or were blocked, explicitly distinguishing browser and native verification.
4. Remaining risks/limitations and any action truly needed from me.
5. The first eligible M1 task and the files to read for it.

**Then stop. Do not start implementing M1 or the application itself. Do not connect a real cloud account, upload a script, publish the repository, or push code.**

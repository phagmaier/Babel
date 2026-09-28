# Requirement trace

Authority: [SPEC S02.2](../SPEC.md#s02). Product requirements remain **unverified for Local v1**. M1-01 supplies a bounded source/model proof for DOC-01–04 and INV-02/03/11; M1-02 supplies native editor-input evidence on one host for EDIT-01/02/06 and QA-02. Neither proof completes the product requirements. A disabled placeholder or app-info command does not satisfy a Local v1 requirement. Task IDs are in [TODO](../TODO.md). [M0 evidence](test-evidence/M0.md) covers the skeleton; [M1 evidence](test-evidence/M1.md) records the bounded proofs.

| ID       | Target / task                  | Planned acceptance evidence                                                 |
| -------- | ------------------------------ | --------------------------------------------------------------------------- |
| APP-01   | Local v1 · M0-02, M6-G         | Native offline installed app smoke and package report (planned)             |
| APP-02   | Local v1 · M4-G                | Home/new/open/recent/missing/recovery UI and native flows (planned)         |
| DOC-01   | Local v1 · M1-01, M2-01, M3-G  | M1-01 synthetic Fountain source fixture; independent open remains planned   |
| DOC-02   | Local v1 · M1-01, M3-G         | M1-01 selected byte no-op/edited semantic proof; full codec remains planned |
| DOC-03   | Local v1 · M1-01, M2-01, M3-G  | M1-01 raw/read-only probes; native import remains planned                   |
| DOC-04   | Local v1 · M1-01, M3-G         | M1-01 selected element corpus; full conformance remains planned             |
| EDIT-01  | Local v1 · M1-02, M3-G         | M1-02 native selection/caret proof; editor integration remains planned      |
| EDIT-02  | Local v1 · M3-G                | Table-driven smart key/source/undo tests (planned)                          |
| EDIT-03  | Local v1 · M3-G                | Remappable shortcut and picker keyboard tests (planned)                     |
| EDIT-04  | Local v1 · M3-G                | Local character/location/heading/time completion tests (planned)            |
| EDIT-05  | Local v1 · M3-G, M4-G          | Structural undo and replace-all tests (planned)                             |
| EDIT-06  | Local v1 · M1-02, M3-G         | M1-02 native dead-key/Unicode/paste proof; full IME matrix remains planned  |
| NAV-01   | Local v1 · M4-G                | Scene/section move, keyboard, undo tests (planned)                          |
| NAV-02   | Local v1 · M4-G                | Find/replace scopes and hidden text tests (planned)                         |
| NAV-03   | Local v1 · M4-G                | Command palette keyboard test (planned)                                     |
| CHECK-01 | Local v1 · M4-G                | Snapshot diagnostic/navigation/no-edit tests (planned)                      |
| CHECK-02 | Local v1 · M4-G                | Severity/export-limitation/style distinction tests (planned)                |
| SAVE-01  | Local v1 · M1-04, M2-03        | Native replacement fault matrix (planned)                                   |
| SAVE-02  | Local v1 · M2-04               | Version/session acknowledgement race tests (planned)                        |
| SAVE-03  | Local v1 · M2-02, M2-05        | Journal corruption and restart recovery drills (planned)                    |
| SAVE-04  | Local v1 · M2-05, M6-G         | Snapshot retention, restore, separate backup drill (planned)                |
| SAVE-05  | Local v1 · M2-01, M2-05, M6-G  | External/instance/Save As/close failure tests (planned)                     |
| HIST-01  | Local v1 · M1-05, M2-06, M6-G  | Disposable native Git revision tests (planned)                              |
| HIST-02  | Local v1 · M6-G                | Timeline/diff/non-destructive restore tests (planned)                       |
| PDF-01   | Local v1 · M1-03, M5-G         | Offline profile and rendered fixture corpus (planned)                       |
| PDF-02   | Local v1 · M5-G                | Versioned page-count and preview/export agreement (planned)                 |
| PDF-03   | Local v1 · M1-03, M5-G         | Wrapping/continuation/splitting/dual visual goldens (planned)               |
| PDF-04   | Local v1 · M1-03, M5-G         | Renderer/font/profile pin, unsupported-warning tests (planned)              |
| UX-01    | Local v1 · M4-G                | Theme/focus/zoom/typewriter native interaction (planned)                    |
| UX-02    | Local v1 · M4-G                | Offline spellcheck per WebView/platform (planned)                           |
| UX-03    | Local v1 · M4-G                | Character focus/counts/position restore (planned)                           |
| SEC-01   | Local v1 · M0-02, M6-G         | Restricted capability audit and offline runtime test (planned)              |
| SEC-02   | Local v1 · M2-01, M3-G, M6-G   | Untrusted input/path/HTML/credential/helper tests (planned)                 |
| QA-01    | Every milestone · M0-04, M1–M7 | Layered unit/property/UI/native/recovery/visual reports (planned beyond M0) |
| QA-02    | Local v1 · M1-02, M6-G         | M1-02 one-host key/frame baseline; Tier 1 platform matrix remains planned   |
| QA-03    | Local v1 · M6-G                | Migration pilot, restore drill, owner-reviewed adoption (planned)           |
| SYNC-01  | Remote · M7-G                  | Same home/editor explicit operations (planned)                              |
| SYNC-02  | Remote · M7-G                  | Save-before-fetch/divergence/no-force tests (planned)                       |
| SYNC-03  | Remote · M7-G                  | Private visibility/privacy decision and adapter evidence (planned)          |
| SYNC-04  | Remote · M7-G                  | New-destination remote-open test (planned)                                  |
| SYNC-05  | Remote · M7-G                  | Last-check/cancel/auth/uncertain-result tests (planned)                     |

M0 contributes infrastructure only. Later milestone groups must be decomposed and this trace refined before implementation. Requirement completion requires the [SPEC S15](../SPEC.md#s15) evidence gate, not the presence of a source file.

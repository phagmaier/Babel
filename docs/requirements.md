# Requirement trace

Authority: [SPEC S02.2](../SPEC.md#s02). Product requirements remain **unverified for Local v1**. The rows below distinguish bounded proof evidence from planned product acceptance; exact results live in [M0](test-evidence/M0.md), [M1](test-evidence/M1.md) and [M2 evidence](test-evidence/M2.md). [TODO](../TODO.md) owns task status. The [independent review](reviews/2026-09-28-m2-05b-review.md) required two corrections; the owner [accepted M2-05B-R1](test-evidence/M2-05B-R1.md) at `5e84879` on 2026-09-28, closing M2-05B acceptance. [M1-06](editor-composition-proof.md) has [bounded native composition evidence](test-evidence/M1.md#m1-06--bounded-codeceditornative-composition-proof); full source/editor and Local v1 acceptance remain open. Neither source files nor disabled UI prove requirement completion.

| ID       | Target / task                            | Planned acceptance evidence                                                                                                                                                                     |
| -------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APP-01   | Local v1 · M0-02, M6-G                   | Native offline installed app smoke and package report (planned)                                                                                                                                 |
| APP-02   | Local v1 · M3-09/12, M4-G                | Core native New/Open entry: M3-09/12 planned; full home/recent/missing/recovery workflows remain M4.                                                                                            |
| DOC-01   | Local v1 · M1-01, M2-01, M3-01–04, M3-13 | M3-04 sole state, immutable source/caret capture and native synthetic editing passed; production lifecycle remains M3-09/11–13.                                                                 |
| DOC-02   | Local v1 · M1-01, M3-01–04/13            | M3-02/03 exact-byte primary/complex codec and M3-04 no-op/edit/undo source bridge passed; default native integration remains M3-12/13.                                                          |
| DOC-03   | Local v1 · M1-01, M2-01, M3-01–04/13     | M3-03 retained-original conversion/refusal and M3-04 protected/raw preservation passed; native import/workflow integration remains open.                                                        |
| DOC-04   | Local v1 · M1-01, M3-01–04/08/13         | M3-03 complex model and M3-04 typed row/mark projection passed; full formatting/paste input remains M3-08, title form M4.                                                                       |
| EDIT-01  | Local v1 · M1-02, M3-04/08/12/13         | M3-04 sole EditorState, source/caret anchors and three real native synthetic edit/capture cases passed; full input/lifecycle remain M3-08/12/13.                                                |
| EDIT-02  | Local v1 · M3-05/06/13                   | Complete key/position/selection/node/source/undo matrix and native composition-to-Enter regression planned.                                                                                     |
| EDIT-03  | Local v1 · M3-06/13                      | Remappable shared shortcut registry, caret/Mixed picker, conversion undo and native focus/conflict checks planned.                                                                              |
| EDIT-04  | Local v1 · M3-07/13                      | Local speaker/segmented-heading indexes, ranking, explicit popup acceptance, key precedence and undo tests planned.                                                                             |
| EDIT-05  | Local v1 · M3-04–08/12/13, M4-G          | M3-04 text/selection undo restores exact source with newer versions; structural/completion/paste/format undo remain M3-05–08; scene/replace M4.                                                 |
| EDIT-06  | Local v1 · M1-02, M3-08/13               | M1 dead-key/Unicode/paste subset passed; M3 safe paste/import and real IME/Unicode/multiline/native undo matrix planned.                                                                        |
| NAV-01   | Local v1 · M4-G                          | Scene/section move, keyboard, undo tests (planned)                                                                                                                                              |
| NAV-02   | Local v1 · M4-G                          | Find/replace scopes and hidden text tests (planned)                                                                                                                                             |
| NAV-03   | Local v1 · M4-G                          | Command palette keyboard test (planned)                                                                                                                                                         |
| CHECK-01 | Local v1 · M4-G                          | Snapshot diagnostic/navigation/no-edit tests (planned)                                                                                                                                          |
| CHECK-02 | Local v1 · M4-G                          | Severity/export-limitation/style distinction tests (planned)                                                                                                                                    |
| SAVE-01  | Local v1 · M2-03, M3-10–13               | M2 replacement/finalize and M1-06 composition passed; production cadence, Save As publication and lifecycle fault gates planned.                                                                |
| SAVE-02  | Local v1 · M2-04, M3-04/10–13            | M2 exact receipts and M3-04 bounded version/session capture/hash races passed; cadence/status/identity-switch integration remains M3-10–13.                                                     |
| SAVE-03  | Local v1 · M2-02/05, M3-09–13            | M2 journal/review/choice/close passed; production recoverable drafts, cadence, startup/editor recovery and restart gates planned.                                                               |
| SAVE-04  | Local v1 · M2-05/06, M3-10/12, M6-G      | M2 snapshots/copies/safety revisions passed; M3 snapshot cadence and production copy wiring planned; configured backup/adoption remain M6.                                                      |
| SAVE-05  | Local v1 · M2-01/05, M3-09–13, M6-G      | M2 ownership/divergence, recovery choices/R1, copies & close passed on tmpfs/Btrfs; M3-09–13 native picker, Save As, conflict/close integration planned; release/platform hardening remains M6. |
| HIST-01  | Local v1 · M1-05, M2-06, M6-G            | M1-05 library/local-transport proof; M2-06 native curated commits/safety refs/interruption/history-failure isolation passed; production scheduling/status UI and M6 adoption remain open        |
| HIST-02  | Local v1 · M1-05, M6-G                   | M1-05 new-child restore and preserved parents; timeline/diff UI remains M6                                                                                                                      |
| PDF-01   | Local v1 · M1-03, M5-G                   | M1-03 Screenplain offline profile probe on synthetic corpus; frozen profile and bundled package remain planned                                                                                  |
| PDF-02   | Local v1 · M5-G                          | Versioned page-count and preview/export agreement (planned)                                                                                                                                     |
| PDF-03   | Local v1 · M1-03, M5-G                   | M1-03 wrapping/continuation/split/dual visual probe with explicit gaps; goldens remain planned                                                                                                  |
| PDF-04   | Local v1 · M1-03, M5-G                   | M1-03 renderer/font pins and silent-loss list (SC005/SC008 open); profile pin and warning tests remain planned                                                                                  |
| UX-01    | Local v1 · M4-G                          | Theme/focus/zoom/typewriter native interaction (planned)                                                                                                                                        |
| UX-02    | Local v1 · M4-G                          | Offline spellcheck per WebView/platform (planned)                                                                                                                                               |
| UX-03    | Local v1 · M4-G                          | Character focus/counts/position restore (planned)                                                                                                                                               |
| SEC-01   | Local v1 · M0-02, M6-G                   | Restricted capability audit and offline runtime test (planned)                                                                                                                                  |
| SEC-02   | Local v1 · M2-01, M3-08/09/11–13, M6-G   | M2 no-follow/path-free IPC passed; M3 hostile paste/native destination/identity/capability checks planned; credentials/helpers remain M6/M7.                                                    |
| QA-01    | Every milestone · M0-04, M1–M7, M1-06    | M0/M1/M2 reports and M3-01 independent corpus/renderer/failure-oracle checks recorded; production/editor/native/milestone verification remains open.                                            |
| QA-02    | Local v1 · M1-02, M3-08/10/13, M6-G      | M1 one-host baseline passed; M3 native input/cadence measurements planned; declared Tier 1 and long-session release gates remain M6.                                                            |
| QA-03    | Local v1 · M6-G                          | Migration pilot, restore drill, owner-reviewed adoption (planned)                                                                                                                               |
| SYNC-01  | Remote · M7-G                            | Same home/editor explicit operations (planned)                                                                                                                                                  |
| SYNC-02  | Remote · M7-G                            | Save-before-fetch/divergence/no-force tests (planned)                                                                                                                                           |
| SYNC-03  | Remote · M7-G                            | Private visibility/privacy decision and adapter evidence (planned)                                                                                                                              |
| SYNC-04  | Remote · M7-G                            | New-destination remote-open test (planned)                                                                                                                                                      |
| SYNC-05  | Remote · M7-G                            | Last-check/cancel/auth/uncertain-result tests (planned)                                                                                                                                         |

M0 contributes infrastructure only. Later milestone groups must be decomposed and this trace refined before implementation. Requirement completion requires the [SPEC S15](../SPEC.md#s15) evidence gate, not the presence of a source file.

M2-05 decomposition: M2-05A supplies read-only startup local recovery review (SAVE-03, INV-07/10/20); M2-05B supplies explicit adoption/source comparison/conflict choices (SAVE-03/05); M2-05C supplies snapshots/retention/backup copies (SAVE-04, INV-20); M2-05D supplies protected close/failure escalation (SAVE-05). All four bounded Linux acceptance gates passed. M2-06 completed the bounded Linux headless exit; full Local v1 remains open.

## M3 decomposition coverage (planned)

[M3-00](test-evidence/M3.md#m3-00--decomposition) maps the core milestone to the tasks below. [M3-01 conformance](test-evidence/M3.md#m3-01--independent-conformance-corpus-and-oracle) passed its bounded corpus/proof comparison; [M3-02 primary codec foundation](test-evidence/M3.md#m3-02--production-source-aware-codec-foundation) also passed; [M3-03 complex codec](test-evidence/M3.md#m3-03--complex-fountain-regions-and-inline-semantics) passed its bounded gate; production requirement completion remains open. [M3-04 editor bridge](test-evidence/M3.md#m3-04--sole-editor-authority-and-source-bridge) passed its bounded gate. M3-05 is next; M3-09 is also dependency-ready. Other tasks wait for their listed predecessors. Existing M1/M2 evidence remains bounded; these mappings do not establish product completion.

| Requirement | M3 task owners                                                |
| ----------- | ------------------------------------------------------------- |
| DOC-01      | M3-01/02/04/09/11/12/13                                       |
| DOC-02      | M3-01/02/03/04/11/12/13                                       |
| DOC-03      | M3-01/02/03/04/09/12/13                                       |
| DOC-04      | M3-01/02/03/08/12/13                                          |
| EDIT-01     | M3-04/08/12/13                                                |
| EDIT-02     | M3-05/06/12/13                                                |
| EDIT-03     | M3-06/12/13                                                   |
| EDIT-04     | M3-07/12/13                                                   |
| EDIT-05     | M3-04/05/06/07/08/12/13; remaining scene/replace workflows M4 |
| EDIT-06     | M3-08/12/13                                                   |
| SAVE-01     | M3-10/11/12/13                                                |
| SAVE-02     | M3-04/10/11/12/13                                             |
| SAVE-03     | M3-09/10/11/12/13                                             |
| SAVE-04     | M3-10/12/13; configured external backup/adoption M6           |
| SAVE-05     | M3-09/11/12/13; release/platform hardening M6                 |
| SEC-02      | M3-08/09/11/13                                                |
| QA-01       | M3-01/13; shared feature checks throughout M3                 |
| QA-02       | M3-08/10/13; release/native platform matrix M6                |

M3-01's independent renderer comparison covers only declared supported semantics and never treats omissions as permission for source loss. M3-13 reviews the full source/editor/native composition in the default app. M3 excludes full M4 daily workflows, M5 publication, M6 Local v1 installed/offline/migration/owner adoption and M7 real remote transfer; all remain open.

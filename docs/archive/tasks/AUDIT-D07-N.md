# AUDIT-D07-N — native typed-export drill

Status: **done 2026-10-04**; base `c36c7d7`.
[Evidence](../../test-evidence/AUDIT.md#audit-d07-n--native-typed-export-drill).
Dependencies: AUDIT-D07 (fixture and JSDOM/helper oracles) complete. Its
evidence leaves one gate blocked: "type in the app, Export PDF, `pdftotext`" has
no drill mode. Requirements: SPEC S07.2/S07.6, S09.2, PDF-01/04, INV-03/10.

## Deliverable and acceptance

- **One drill mode**, `tests/native/writing-lifecycle/typed_export.py`
  (`drill.py --typed-export`), also selectable as `typed-export` in
  `integrated_exit.py`.
- **From an empty document** in the real release app it types the S07.2 scene
  of `fixtures/assessment/typed-scene.json` with trusted WebDriver keys, the
  Element picker and the dual-dialogue command button, following the JSDOM
  oracle's key sequence, including the two suggestions Enter must accept and
  the D07-F3/F4 workarounds.
- **Checks**, all against the hand-written fixture: editor rows and
  speech/dual pairing; the bytes saved through the native Save As picker equal
  `source`; Export PDF goes straight to the destination (no review) and shows
  the omission summary; the receipt's source hash is the fixture's; `pdfinfo`
  page count and per-page `pdftotext` match `pages` in order; `omits` absent.
- Runs on tmpfs and Btrfs with owned-process crash audits.

## Do NOT do

Change product source, Rust, IPC, the helper, profile, fonts or pins; change
the fixture; call an editor-state hook or a native command from a script
(scripts observe; input is trusted). No fix for D07-F1..F4: they stay with the
owner.

## Checks and stopping

`python3 -m py_compile`, `sh tools/lint-py.sh`; the mode alone on tmpfs, then
`integrated_exit.py /tmp $PWD/target --modes typed-export` with the binary in
place. One injected fault (a wrong fixture byte in a scratch copy) must fail
the drill. Record evidence; update TODO, current-state and the harness README;
one commit.

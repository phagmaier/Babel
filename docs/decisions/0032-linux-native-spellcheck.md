# ADR 0032 — Linux native offline spellcheck

Status: Accepted direction after bounded Linux proof. Date: 2026-09-30.
Authority: [SPEC S08.5/S14/S19](../../SPEC.md#s08), UX-02, SEC-01/02,
INV-01/03/11/14/16/17/18. [M4-11 evidence](../test-evidence/M4.md#m4-11--offline-spellcheck-proof).

## Context and decision

Select the existing WebKitGTK 4.1 → Enchant → Hunspell local integration for
the provisional Linux target. The isolated native probe uses the existing sole
editor and actual native menus/corrections, with exact source/selection/Undo,
language, name, restart and trusted IME checks. No fallback engine, runtime
dependency, resource or production activation is added by M4-11.

M4-12 owns a narrow native capability/language boundary, presentation-only name
suppression and application-scoped vocabulary. Set a private
`ENCHANT_CONFIG_DIR` before native toolkit/worker initialization; do not use the
owner's ordinary system personal dictionary. Validate/report available languages
and the effective selection. English `en_US` and `en_US-large` are aliases of
the same installed resource here; unavailable `fr_FR` returned no loaded language
and no English suggestions. No other language or platform is certified.

Language/checking preferences are application-wide: a second WebKit context
changes the first context's loaded languages. Native continuous-check disabling
does not remove context-menu suggestions; the production Off/name policy must
also set appropriate view-only `spellcheck` attributes/menu availability.
The probe verified an inline decoration suppresses an established name without
source, version or Undo changes. Production derivation must be version-bound;
the fixed synthetic range is not a shipped name engine.

Native Ignore requires a selected word and lasts until dictionary/session
reload; Learn requires selection and persists to the local personal dictionary.
ASCII and Unicode names were written as UTF-8; the ASCII name survived process
restart and stayed absent in a fresh profile. A learned mixed-case name also
covered its uppercase character cue.
Neither operation edits the manuscript. Native correction is explicit and
observed by the existing editor authority, preserving marks/origin metadata and
one-step Undo. No second live content model or asynchronous direct DOM writer
is authorized.

## Resources, licenses and alternatives

Existing locked native adapters are Tauri 2.12.0, wry 0.57.0, tao 0.37.1,
`webkit2gtk` 2.0.2 and `gtk` 0.18.2; the default release links the same system
WebKit/GTK/Enchant ABI as the isolated host. No lockfile changes. Recorded host
resources, not new app pins or bundled artifacts:

| Resource                       | Version          | License/obligation                                                                                                     |
| ------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| WebKitGTK 4.1 / GTK3           | 2.52.6 / 3.24.52 | Existing native runtime; collect exact component notices before distribution                                           |
| Enchant                        | 2.8.21           | LGPL-2.1-or-later; existing WebKit dependency, provider/resource inventory required                                    |
| Hunspell provider/library      | 1.7.3            | LGPL-2.1-or-later OR GPL-2.0-or-later OR MPL-1.1; exact distribution notices required                                  |
| `hunspell-en_us` / SCOWL large | 2026.02.25       | Package lists LGPL-2.1-or-later, LGPL-2.1-only and BSD-3-Clause-Modification; retain full dictionary copyright/notices |
| JSON-GLib                      | 1.10.8           | LGPL-2.1-or-later; isolated C probe only, no new application dependency                                                |

English base files are `/usr/share/hunspell/en_US-large.aff` and `.dic`;
`en_US.aff/.dic` symlink to them. The active provider is
`/usr/lib/enchant-2/enchant_hunspell.so`. Installed but unloadable Aspell,
Hspell, Nuspell and Voikko modules provide no verified coverage. The test
personal dictionary lives only at `<task profile>/dictionary/en_US.dic`.
System native libraries alone do not guarantee a dictionary on another install.
M4-12 must make missing resources an explicit unavailable capability and verify
default-release resource availability; installed/offline distribution stays gated.

A second local engine would duplicate a verified native dictionary path and add
packaging/license work. It was not evaluated because the bounded native proof
passed. A cloud grammar/spellcheck service contradicts the offline contract and
is excluded. If production cannot meet the remaining native obligations, reopen
this decision for exactly one bounded local fallback proof.

## Evidence and consequences

[Probe instructions](../../tests/native/spellcheck/README.md) reproduce the
network-less GTK host, private profiles and physical native menu acceptance.
This is native integration evidence, distinct from default Tauri activation.
No publication adapter or author-content filesystem behavior changed.

Current official [WebContext language API](https://webkitgtk.org/reference/webkitgtk/stable/method.WebContext.set_spell_checking_languages.html)
was fetched through Context7. Exact
[WebKit 2.52.6 Enchant source](https://github.com/WebKit/WebKit/blob/webkitgtk-2.52.6/Source/WebCore/platform/text/enchant/TextCheckerEnchant.cpp)
supports the local backend/session distinction; the matching
[context-menu source](https://github.com/WebKit/WebKit/blob/webkitgtk-2.52.6/Source/WebCore/page/ContextMenuController.cpp)
requires a range for Ignore/Learn. Installed Enchant 2.8.21 documentation
(`/usr/share/doc/enchant/enchant.html`) documents `ENCHANT_CONFIG_DIR` and XDG
scope. Installed package metadata and full dictionary copyright were inspected;
this is not a completed transitive release license audit.

Production refinement: [ADR 0033](0033-production-spellcheck-boundary.md) owns the typed Enchant ABI, explicit empty personal wordlist, application dictionary publication and guarded editor corrections chosen in M4-12. The proof's native Learn/menu approach remains historical evidence.

Evidence still needed at the proof boundary: M4-12 production activation, application-owned language/
vocabulary preference and resource discovery, explicit dictionary write-failure
handling (native Learn has no public persistence receipt), composing/protection/
stale correction guards, native keyboard menu accessibility, default-release
integration/resources; large-script/long-session cost, installed packages and
other declared platforms. Do not treat the isolated proof as full M4 or Local v1.

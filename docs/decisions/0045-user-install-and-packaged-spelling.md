# ADR 0045: Per-user AppImage install and a self-contained spelling provider

Status: **Accepted direction; implemented and natively verified in M6-14 2026-10-06**
Date: 2026-10-06. Task: [M6-14](../tasks/M6-14.md). Decided by the working agent
under [ADR 0043](0043-agent-decision-authority.md). Refines
[ADR 0033](0033-production-spellcheck-boundary.md);
[evidence](../test-evidence/M6-14-2026-10-06.md).

## Context

The first real desktop install of the AppImage showed three things no earlier
run could, because they all ran the unbundled release binary or an extracted
folder.

1. **Packaged spellcheck never worked.** Enchant finds its provider modules
   relative to its own library file. The bundler copied `libenchant-2.so.2`
   into the package but not `enchant-2/enchant_hunspell.so`, so the packaged
   app had no provider on any host and showed every language as unavailable.
2. **The package runs with its working directory inside its read-only mount.**
   The bundled WebKit resolves its helper processes relative to that directory
   (`././/lib/webkit2gtk-4.1/…`), so the process must stay there. GTK opens a
   save picker in the working directory, so Save As and Export PDF started in
   the package folder, where saving is refused.
3. There was no install: only a file to run from a terminal.

## Decision

- **Install is per user and reversible.** [`tools/install-desktop.py`](../../tools/install-desktop.py)
  copies the package to `~/.local/opt/babel` (or `--install-dir`) and writes one
  desktop entry in the user's XDG applications folder. No root, system file,
  MIME default or autostart. Each distinct package keeps its own
  content-named file, so an update never overwrites the previous one.
  Uninstall removes only files it recorded and that are unchanged; it never
  touches screenplays or app data. A foreign entry of the same name is never
  overwritten. A path containing `%` is refused: GLib rejects such an entry.
- **The package carries its own spelling provider.** The build stages the
  Hunspell provider of the Enchant it links, and the Hunspell library that
  provider loads, into the AppImage beside the bundled Enchant
  ([`tools/stage-spellcheck-provider.py`](../../tools/stage-spellcheck-provider.py)).
  This is the same single Enchant/Hunspell backend as ADR 0033, not a second
  engine. It requires a **relocatable** Enchant at build time: distribution
  builds are, an upstream build needs `--enable-relocatable` (CI's now has
  it). Staging proves this on a copy and fails the build otherwise.
  **Dictionaries stay a host prerequisite**: the provider reads
  `<XDG data dir>/hunspell` (normally `/usr/share/hunspell`) and the private
  `<config>/enchant/hunspell`. A host without one gets the existing visible
  "No installed offline dictionary" state; writing and Save are unaffected.
- **Native pickers start in the writer's home folder.** The process does not
  change directory. The app has no file-open argument, so the entry registers
  no file association.

## Alternatives

- Bundle an English dictionary too: self-contained, but adds dictionary
  licence texts to a package that has no notice file yet, and other languages
  would still come from the host. Revisit with M6-10.
- Change directory at startup: breaks the bundled WebKit's helper lookup.
- Use the host's Enchant instead of the bundled one: the bundler copies every
  linked library, and mixing a host provider with a bundled Enchant of another
  version is an ABI risk.

## Consequences

The package now redistributes Enchant's Hunspell provider (LGPL-2.1-or-later)
and Hunspell 1.7.5 (LGPL-2.1-or-later OR GPL-2.0-or-later OR MPL-1.1) in
addition to the libraries it already bundled. Exact notices before any
distribution remain M6-10. `tools/check-package-spellcheck.py` runs in CI
after the package build so a package without its provider fails the build.

Evidence still needed: another distribution or a host with no dictionary
package installed (only simulated here by hiding the folder), other languages,
a second package version for a real manual update, and release notices.

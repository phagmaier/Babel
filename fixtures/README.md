# Fixture conventions

Only original synthetic scripts with known provenance belong here; never copy a private manuscript or web screenplay. `fountain/` will contain tiny named source cases, including minimal elements, ambiguous markers, title variants, dual dialogue, notes/omissions, Unicode, intentional blanks, malformed/raw regions, and exact CRLF/BOM bytes. `expected/` will contain independently reviewed semantics/diagnostics and, later, separately reviewed PDF layout evidence.

Each fixture must document purpose, requirement IDs, expected behavior, provenance, and encoding/newline properties. Git treats `fixtures/**` as binary for newline-conversion purposes, and formatters exclude the folder. Do not open/format/rewrite byte-sensitive fixtures casually. Large stress scripts should be generated from documented deterministic synthetic recipes, not actual author work. See [SPEC S06/S15](../SPEC.md#s06).

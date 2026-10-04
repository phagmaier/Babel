# Fixture conventions

Only original synthetic scripts with known provenance belong here; never copy a private manuscript or web screenplay. `fountain/` contains tiny named source cases, including minimal elements, ambiguous markers, title variants, dual dialogue, notes/omissions, Unicode, intentional blanks, malformed/raw regions, and exact CRLF/BOM bytes. `expected/` contains the [M3-01 independent literal/semantic oracles](expected/README.md); the [M5-03 publication corpus](publication/REVIEW.md) adds reviewed PDF layout/text/image goldens and declared unsupported cases.

The M1-01 [fixture manifest](fountain/README.md) contains the original byte probes.
[Production codec assertions](../tests/contract/production-fountain.test.ts) retain
their no-op byte coverage and the independent M3 corpus guards after AUDIT-SLP-B
retired the M1 prototype codec. Original fixture bytes/oracles stay unchanged.

Each fixture must document purpose, requirement IDs, expected behavior, provenance, and encoding/newline properties. Git treats `fixtures/**` as binary for newline-conversion purposes, and formatters exclude the folder. Do not open/format/rewrite byte-sensitive fixtures casually. Large stress scripts should be generated from documented deterministic synthetic recipes, not actual author work. See [SPEC S06/S15](../SPEC.md#s06).

The [M3-01 corpus](expected/README.md) adds 12 cases and nine complete edited-source oracles, a source/semantic contract suite and an isolated Screenplain AST/HTML comparison. These establish a bounded proof corpus; production codec/editor conformance remains open.

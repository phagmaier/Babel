# Decision records

Files are named `NNNN-slug.md`. Each ADR keeps: context, decision, alternatives, consequences, status, source/requirement links, and an explicit `Evidence still needed` line.

Status vocabulary:

| Status             | Meaning                                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| Accepted direction | Product/boundary choice is agreed; implementation proof may still be open |
| Pending proof      | M1/M2 evidence is required before promotion to implementation             |
| Deferred           | Decision is intentionally postponed to a named milestone                  |
| Superseded         | Replaced by a newer ADR (link it)                                         |

Do not use an ADR to bypass `SPEC.md`; a newer accepted ADR that changes the spec must explicitly identify the spec change.

Status lines begin with one vocabulary term; qualifiers retain bounded proof and historical limitations. `pnpm check:guidance` checks the prefix.

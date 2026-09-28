# UX and accessibility

Status: M0 shell plus M2-05A read-only local startup recovery review. [SPEC S08/S14](../SPEC.md#s08); APP-02, NAV-01–03, UX-01–03, SEC-01, INV-10.

M0 presents an application heading, explicit development status, and disabled New/Open actions. It has no recent registry, recovery list, manuscript status, or editor. The future home screen must make New, Open Fountain, recent/missing files, and recovery distinct. Remove from Recents cannot delete source. Project creation asks for a destination or explicitly creates a recoverable unsaved draft.

The future writing view is continuous, with title, optional scene/section outline, element picker, writing area, and status. Status must distinguish live dirty version, recovery protection, source-file saved version, page-count freshness, and remote last-check state. Never infer "saved" or "up to date" from a queued job or old check. Search includes hidden author text with explicit filters; replace-all and scene moves are reversible, have keyboard equivalents, and preserve structure. Script Check is a separate, non-destructive panel. Read-only PDF preview is the printed-page authority.

Local v1 includes light/dark, focus, zoom, typewriter scroll, offline spellcheck, character focus/list, title-page UI, counts with inclusion rules, recent position, and a command palette. Use semantic controls, focus visibility, sufficient contrast, reduced-motion behavior, keyboard reachability, and native tests for IME, dead keys, scaling, clipboard, and close flows. M0 visual inspection is recorded in [evidence](test-evidence/M0.md); it cannot establish the future UX contract.

M2-05A adds startup checkpoint summaries, damaged/pending/conflicting material
notices, text/hex previews, Refresh and Inspect Later. Content is rendered as
literal text, with truncated display explicitly labeled. Failure never exposes
arbitrary transport text or claims an empty successful scan. Deferral does not
resolve/delete the case, and previews do not restore/save a screenplay. Explain
that these local checkpoints are not a separate disk backup. Native source
selection/comparison and the three resolution choices remain M2-05B, alongside
future managed-project discovery. New/Open remain disabled. [ADR 0016](decisions/0016-read-only-startup-recovery-review.md).

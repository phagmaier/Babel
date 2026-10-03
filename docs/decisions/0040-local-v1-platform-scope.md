# ADR 0040: Linux first, preserve future portability

Status: **Accepted owner direction**
Date: 2026-10-02. Task: M6-01.

## Decision

The owner declares Linux for now and wants future portability. The agent stated
Linux x86_64, using the detected current host architecture, before proceeding.
This scopes the current implementation and verification; x86_64 is inferred
from the authorized host, not a separate owner architecture declaration.
M6-13/14 need exact owner-confirmed release targets. This grants no blanket
support for all distributions, filesystems, graphics stacks or architectures.
Actual acceptance remains bounded to tested host/build/workload evidence. [Development target scope](../development.md#declared-local-v1-targets-m6).

Keep domain/source/IPC contracts portable and native persistence, window/input
and packaging semantics in platform adapters. SPEC S01.2's future Windows/macOS
portability remains intact; those OSes and other architectures require later
owner declarations, bounded implementation and native/installed verification.
No framework choice or Linux test establishes their support.

## Evidence still needed

M6-01 current Linux close/recovery hardening; M6-13 native/input/accessibility and
filesystem matrix; M6-14 actual installed/offline/manual-update coverage; M6-16
owner pilot and Local v1 admission. No cross-platform or full Linux-distribution
acceptance, system installation, fee or signing decision is implied.
[Planning](../tasks/M6-00.md), [M6 evidence](../test-evidence/M6.md).

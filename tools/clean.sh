#!/bin/sh
# clean.sh — prune regenerable build/test output without touching source.
#
# Retention policy: a run root or output dir named anywhere under docs/ is
# linked evidence and is KEPT by default; anything else matching the
# disposable patterns is safe to delete and is recreated by rerunning the
# documented command. `target/pdf-helper` (network-filled cache + runtime),
# `target/debug` and `target/release` (build caches) are never candidates.
#
# Default is a dry run that lists KEEP vs PRUNE. Flags:
#   --apply              delete the disposable (unreferenced) candidates only
#   --include-evidence   also delete docs-referenced run roots and m*-evidence
#                        dirs (breaks evidence links; owner decision)
#   --include-dev        also delete target/dev-python (recreate per
#                        docs/development.md inspection-venv steps)
# Usage: sh tools/clean.sh [--apply] [--include-evidence] [--include-dev]
set -eu
unset CDPATH

ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
APPLY=0
WITH_EVIDENCE=0
WITH_DEV=0
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --include-evidence) WITH_EVIDENCE=1 ;;
    --include-dev) WITH_DEV=1 ;;
    -h | --help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *)
      printf 'clean: unknown flag %s (see --help)\n' "$arg" >&2
      exit 2
      ;;
  esac
done

TARGET="$ROOT/target"
[ -d "$TARGET" ] || {
  printf 'clean: no target/ under %s\n' "$ROOT"
  exit 0
}

# Every run-root/output name mentioned in docs/ is linked evidence.
REFERENCED="$(grep -rhoE "(babel-writing-[A-Za-z0-9_]+|profile-check-[A-Za-z0-9_-]+|m[345](-[0-9-]+)?)" "$ROOT/docs" 2>/dev/null | sort -u || true)"

is_referenced() {
  printf '%s\n' "$REFERENCED" | grep -qxF "$1"
}

PRUNE=""
KEPT=0
consider() { # path kind(evidence|disposable|devenv)
  dir="$1"
  kind="$2"
  base="$(basename "$dir")"
  case "$dir" in
    "$TARGET"/*) ;;
    *)
      printf 'clean: refusing path outside target/: %s\n' "$dir" >&2
      exit 2
      ;;
  esac
  [ "$dir" != "$TARGET" ] || {
    printf 'clean: refusing target/ itself\n' >&2
    exit 2
  }
  case "$kind" in
    evidence)
      if [ "$WITH_EVIDENCE" -eq 1 ]; then
        PRUNE="$PRUNE
$dir"
      else
        KEPT=$((KEPT + 1))
        printf 'keep   %s (linked evidence; needs --include-evidence)\n' "$dir"
      fi
      ;;
    disposable)
      if is_referenced "$base"; then
        if [ "$WITH_EVIDENCE" -eq 1 ]; then
          PRUNE="$PRUNE
$dir"
        else
          KEPT=$((KEPT + 1))
          printf 'keep   %s (named in docs/; needs --include-evidence)\n' "$dir"
        fi
      else
        PRUNE="$PRUNE
$dir"
      fi
      ;;
    devenv)
      if [ "$WITH_DEV" -eq 1 ]; then
        PRUNE="$PRUNE
$dir"
      else
        KEPT=$((KEPT + 1))
        printf 'keep   %s (needs --include-dev)\n' "$dir"
      fi
      ;;
  esac
}

for hit in "$TARGET"/babel-writing-* "$TARGET"/profile-check-*; do
  [ -e "$hit" ] || continue
  consider "$hit" disposable
done
for hit in "$TARGET"/m3-* "$TARGET"/m4-15-* "$TARGET"/m5-*; do
  [ -e "$hit" ] || continue
  consider "$hit" evidence
done
[ -e "$TARGET/dev-python" ] && consider "$TARGET/dev-python" devenv

PRUNE="$(printf '%s\n' "$PRUNE" | sed '/^[[:space:]]*$/d' | sort -u)"
if [ -z "$PRUNE" ]; then
  printf 'clean: nothing prunable (%d kept).\n' "$KEPT"
  exit 0
fi

if [ "$APPLY" -eq 0 ]; then
  printf '%s\n' "$PRUNE" | while IFS= read -r dir; do
    printf 'prune  %s (%s)\n' "$dir" "$(du -sh "$dir" 2>/dev/null | cut -f1)"
  done
  printf '\nclean: dry run — %d kept, rerun with --apply to delete. Always kept: target/pdf-helper, target/debug, target/release.\n' "$KEPT"
  exit 0
fi

fail=0
while IFS= read -r dir; do
  [ -n "$dir" ] || continue
  printf 'removing %s (%s)\n' "$dir" "$(du -sh "$dir" 2>/dev/null | cut -f1)"
  # Test leftovers may carry read-only modes from permission-failure drills.
  chmod -R u+rwX -- "$dir" 2>/dev/null || true
  rm -rf -- "$dir" || {
    printf 'FAILED %s (kept)\n' "$dir"
    fail=1
  }
done <<EOF
$PRUNE
EOF
if [ "$fail" -ne 0 ]; then
  printf '\nclean: %d kept, some removals FAILED (listed above) — rerun to retry.\n' "$KEPT"
  exit 1
fi
printf '\nclean: done, %d kept. Always kept: target/pdf-helper, target/debug, target/release.\n' "$KEPT"

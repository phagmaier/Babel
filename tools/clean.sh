#!/bin/sh
# clean.sh — prune regenerable build/test output without touching source.
#
# Default is a dry run that only lists what would go. Pass --apply to delete.
# NEVER removed: target/pdf-helper/cache (needs network to refill), source,
# fixtures, lockfiles, installed node_modules.
# Usage: sh tools/clean.sh [--apply]
set -eu
unset CDPATH

ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
APPLY=0
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    -h | --help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *)
      printf 'clean: unknown flag %s (see --help)\n' "$arg" >&2
      exit 2
      ;;
  esac
done

TARGETS=""
for pattern in "m4-15-*" "m5-*" "m3-*" "babel-writing-*" "profile-check-*"; do
  # shellcheck disable=SC2086
  for hit in $ROOT/target/$pattern; do
    [ -e "$hit" ] || continue
    case "$hit" in
      "$ROOT/target/pdf-helper") continue ;;
    esac
    TARGETS="$TARGETS
$hit"
  done
done
# Stale dev venv lives under target/ so cargo clean wipes it; recreate via docs.
if [ -e "$ROOT/target/dev-python" ]; then
  TARGETS="$TARGETS
$ROOT/target/dev-python"
fi
TARGETS="$(printf '%s\n' "$TARGETS" | sed '/^[[:space:]]*$/d' | sort -u)"

if [ -z "$TARGETS" ]; then
  printf 'clean: nothing to prune.\n'
  exit 0
fi

printf '%s\n' "$TARGETS" | while IFS= read -r dir; do
  size="$(du -sh "$dir" 2>/dev/null | cut -f1)"
  if [ "$APPLY" -eq 1 ]; then
    printf 'removing %s (%s)\n' "$dir" "$size"
    rm -rf -- "$dir"
  else
    printf 'would remove %s (%s)\n' "$dir" "$size"
  fi
done

if [ "$APPLY" -eq 0 ]; then
  printf '\nclean: dry run — rerun with --apply to delete. Kept: target/pdf-helper/cache, target/debug, target/release.\n'
else
  printf '\nclean: done. Kept: target/pdf-helper/cache, target/debug, target/release.\n'
fi

#!/bin/sh
# bootstrap.sh — one-command second-machine setup for a fresh checkout.
#
# Steps: trust/install toolchains, install locked deps, build the bundled
# PDF renderer. Pass --skip-helper to skip the renderer build (plain cargo
# commands work without it; `pnpm tauri dev` needs it — see docs/development.md).
# Pass --dry-run to print the commands without running them.
# Usage: sh tools/bootstrap.sh [--skip-helper] [--dry-run]
set -eu
unset CDPATH

ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
SKIP_HELPER=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --skip-helper) SKIP_HELPER=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h | --help)
      sed -n '2,9p' "$0"
      exit 0
      ;;
    *)
      printf 'bootstrap: unknown flag %s (see --help)\n' "$arg" >&2
      exit 2
      ;;
  esac
done

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '+ %s\n' "$*"
  else
    printf '+ %s\n' "$*"
    "$@"
  fi
}

run mise trust "$ROOT/mise.toml"
run mise install
run mise exec -- pnpm install --frozen-lockfile
if [ "$SKIP_HELPER" -eq 0 ]; then
  run mise exec -- pnpm pdf-helper
fi

printf '\nbootstrap: done. Next: sh tools/doctor.sh && sh tools/check-host.sh\n'
printf 'Then: mise exec -- pnpm tauri dev\n'

#!/bin/sh
# doctor.sh — verify toolchain pins agree and required tools are present.
#
# Single source of truth lives in mise.toml; rust-toolchain.toml,
# .node-version and package.json must agree with it. Read-only: changes nothing.
# Usage: sh tools/doctor.sh
set -eu
unset CDPATH

ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
FAIL=0

pin() { # file key -> value on stdout, empty when absent
  grep -E "^[[:space:]]*$2[[:space:]]*=" "$1" 2>/dev/null \
    | head -n 1 | sed -E 's/^[^=]*=[[:space:]]*"?([^"]*)"?[[:space:]]*$/\1/' || true
}

need() { # name actual expected
  if [ "$2" = "$3" ]; then
    printf 'ok   %-22s %s\n' "$1" "$2"
  else
    printf 'FAIL %-22s got %s, want %s\n' "$1" "$2" "$3"
    FAIL=1
  fi
}

MISE_NODE="$(pin "$ROOT/mise.toml" node)"
MISE_PNPM="$(pin "$ROOT/mise.toml" pnpm)"
MISE_RUST="$(pin "$ROOT/mise.toml" rust)"
TOOLCHAIN_RUST="$(sed -nE 's/^[[:space:]]*channel[[:space:]]*=[[:space:]]*"([^"]*)".*/\1/p' "$ROOT/rust-toolchain.toml" | head -n 1)"
NODEVERSION="$(tr -d ' \t\r\n' < "$ROOT/.node-version")"
PKG_PNPM="$(sed -nE 's/^[[:space:]]*"packageManager"[[:space:]]*:[[:space:]]*"pnpm@([^"]*)".*/\1/p' "$ROOT/package.json" | head -n 1)"

need "mise node" "$MISE_NODE" "$NODEVERSION"
need "mise pnpm" "$MISE_PNPM" "$PKG_PNPM"
need "mise rust" "$MISE_RUST" "$TOOLCHAIN_RUST"

for tool in node pnpm cargo rustc python3 pkg-config; do
  if command -v "$tool" >/dev/null 2>&1; then
    printf 'ok   tool %-17s %s\n' "$tool" "$(command -v "$tool")"
  else
    printf 'FAIL tool %-17s not on PATH\n' "$tool"
    FAIL=1
  fi
done

if command -v node >/dev/null 2>&1; then
  need "node runtime" "$(node --version | tr -d v)" "$MISE_NODE"
fi
if command -v pnpm >/dev/null 2>&1; then
  need "pnpm runtime" "$(pnpm --version)" "$MISE_PNPM"
fi
if command -v rustc >/dev/null 2>&1; then
  need "rustc runtime" "$(rustc --version | awk '{print $2}')" "$MISE_RUST"
fi

if [ "$FAIL" -ne 0 ]; then
  printf '\ndoctor: MISMATCH — align the pins above, then rerun.\n' >&2
  exit 1
fi
printf '\ndoctor: all pins agree.\n'

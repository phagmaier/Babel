#!/bin/sh
# lint-py.sh — syntax-gate every tracked Python file in the repo.
#
# Zero dependencies beyond python3 itself: compiles each git-tracked *.py
# (75 files: native drill harness, pdf-helper, prototypes, the embedded
# assessment probe) with the stdlib compiler. Catches syntax breakage when
# switching machines/toolchains before the slower drills run.
# Read-only apart from __pycache__ bytecode the compiler writes next to
# sources (that directory is gitignored).
# Usage: sh tools/lint-py.sh
set -eu
unset CDPATH

ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

FILES="$(git ls-files '*.py')"
[ -n "$FILES" ] || {
  printf 'lint-py: no tracked Python files\n'
  exit 0
}

FAIL=0
count=0
while IFS= read -r file; do
  count=$((count + 1))
  if python3 -m py_compile "$file" 2>/tmp/babel-lint-py-err; then
    :
  else
    printf 'FAIL %s\n' "$file"
    cat /tmp/babel-lint-py-err
    FAIL=1
  fi
done <<EOF
$FILES
EOF
rm -f /tmp/babel-lint-py-err

if [ "$FAIL" -ne 0 ]; then
  printf '\nlint-py: %d files checked, failures above.\n' "$count"
  exit 1
fi
printf '\nlint-py: %d files, all compile.\n' "$count"

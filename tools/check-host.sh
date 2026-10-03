#!/bin/sh
# check-host.sh — probe native Linux prerequisites for dev and Tauri builds.
#
# Read-only: changes nothing. Exit 0 when everything needed is present,
# exit 1 otherwise (after printing the install hint for the detected distro).
# Usage: sh tools/check-host.sh
set -eu

FAIL=0
have_bin() { # name [alternates...]
  name="$1"
  shift
  for cand in "$name" "$@"; do
    if command -v "$cand" >/dev/null 2>&1; then
      printf 'ok   %-22s %s\n' "$name" "$(command -v "$cand")"
      return 0
    fi
  done
  printf 'MISS %-22s not on PATH\n' "$name"
  FAIL=1
  return 1
}

have_pc() { # pkg-config module
  if pkg-config --exists "$1" 2>/dev/null; then
    printf 'ok   %-22s %s\n' "$1" "$(pkg-config --modversion "$1" 2>/dev/null || true)"
  else
    printf 'MISS %-22s pkg-config cannot find it\n' "$1"
    FAIL=1
  fi
}

printf '== libraries (pkg-config) ==\n'
if command -v pkg-config >/dev/null 2>&1; then
  have_pc "webkit2gtk-4.1"
  have_pc "gtk+-3.0"
  have_pc "librsvg-2.0"
  have_pc "openssl"
  have_pc "enchant-2"
else
  printf 'MISS pkg-config itself — install pkgconf first\n'
  FAIL=1
fi

printf '== binaries ==\n'
have_bin chromium chromium-browser google-chrome || true
have_bin WebKitWebDriver || true
have_bin xdotool || true
have_bin patchelf || true
have_bin pdftotext || true
have_bin gs || true
have_bin enchant-2 enchant-lsmod-2 enchant-lsmod enchant || true
have_bin hunspell || true
have_bin wtype || true
have_bin grim || true
have_bin wl-copy || true

printf '== python ==\n'
if command -v python3 >/dev/null 2>&1; then
  PYV="$(python3 -c 'import sys; print("%d.%d.%d" % sys.version_info[:3])')"
  printf 'ok   python3                %s\n' "$PYV"
  python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)' \
    || { printf 'MISS python3 >= 3.12 is required for the pdf-helper build\n'; FAIL=1; }
else
  printf 'MISS python3 not on PATH\n'
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  printf '\ncheck-host: MISSING prerequisites.\n'
  if command -v pacman >/dev/null 2>&1; then
    printf 'Arch/Omarchy: sudo pacman -S --needed base-devel webkit2gtk-4.1 gtk3 librsvg openssl pkgconf appmenu-gtk-module libayatana-appindicator xdotool patchelf chromium poppler ghostscript enchant hunspell hunspell-en_us wtype grim wl-clipboard\n'
  elif command -v apt-get >/dev/null 2>&1; then
    printf 'Debian/Ubuntu: sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev librsvg2-dev libayatana-appindicator3-dev chromium poppler-utils ghostscript libenchant-2-dev hunspell hunspell-en-us\n'
  else
    printf 'No pacman/apt-get found — install the WebKitGTK 4.1, GTK3, OpenSSL, Poppler, Enchant/Hunspell and Chromium equivalents for your distro.\n'
  fi
  exit 1
fi
printf '\ncheck-host: all prerequisites present.\n'

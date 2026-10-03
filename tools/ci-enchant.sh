#!/usr/bin/env bash
# CI-only prerequisite; install into a fresh disposable directory, never /usr.
set -euo pipefail
work=${1:?Usage: bash tools/ci-enchant.sh /absolute/fresh/work-directory}
case "$work" in
  /*) ;;
  *) echo 'Enchant work directory must be absolute' >&2; exit 2 ;;
esac
mkdir "$work"
prefix="$work/install"
curl --fail --location --silent --show-error \
  https://github.com/rrthomas/enchant/releases/download/v2.8.21/enchant-2.8.21.tar.gz \
  -o "$work/enchant.tar.gz"
printf '%s  %s\n' dd2a762697c463148a8f59867089a5ebf2dd1449d869f93764b76c12bcf8acc0 "$work/enchant.tar.gz" | sha256sum --check
tar -xzf "$work/enchant.tar.gz" -C "$work"
cd "$work/enchant-2.8.21"
./configure --prefix="$prefix" --libdir="$prefix/lib" --disable-static \
  --with-hunspell --without-aspell --without-nuspell --without-hspell \
  --without-voikko --without-zemberek --without-applespell --without-winspell
make -j2
make install
export PKG_CONFIG_PATH="$prefix/lib/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
export LD_LIBRARY_PATH="$prefix/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
pkg-config --exact-version=2.8.21 enchant-2

# These files belong solely to this synthetic probe. They must be ignored by
# the empty PWL, including the exclusion of a valid English word.
mkdir "$work/profile" "$work/profile-before"
printf 'Babelsyntheticlearnedword\n' > "$work/profile/en_US.dic"
printf 'hello\n' > "$work/profile/en_US.exc"
cp "$work/profile/"* "$work/profile-before/"
cat > "$work/probe.c" <<'EOF'
#include <enchant.h>
#include <stdio.h>
#include <string.h>
int main(int argc, char **argv) {
    (void)argv;
    int control = argc > 1;
    if (strcmp(enchant_get_version(), "2.8.21")) return 1;
    EnchantBroker *broker = enchant_broker_init();
    if (!broker) return 2;
    enchant_broker_set_ordering(broker, "*", "hunspell");
    EnchantDict *dict = control
        ? enchant_broker_request_dict(broker, "en_US")
        : enchant_broker_request_dict_with_pwl(broker, "en_US", "/dev/null");
    if (!dict) { enchant_broker_free(broker); return 3; }
    int failed = (control ? enchant_dict_check(dict, "hello", -1) <= 0
                         : enchant_dict_check(dict, "hello", -1) != 0)
        || enchant_dict_check(dict, "helllo", -1) <= 0
        || (control ? enchant_dict_check(dict, "Babelsyntheticlearnedword", -1) != 0
                    : enchant_dict_check(dict, "Babelsyntheticlearnedword", -1) <= 0);
    enchant_broker_free_dict(broker, dict);
    enchant_broker_free(broker);
    if (!failed) puts(control ? "Synthetic personal-wordlist control passed"
                             : "Enchant 2.8.21 / Hunspell en_US: empty-PWL probe passed");
    return failed;
}
EOF
# pkg-config returns compiler arguments, intentionally split here.
# shellcheck disable=SC2046
cc -Wall -Wextra -Werror "$work/probe.c" $(pkg-config --cflags --libs enchant-2) -o "$work/probe"
ENCHANT_CONFIG_DIR="$work/profile" "$work/probe" --personal-control
ENCHANT_CONFIG_DIR="$work/profile" "$work/probe"
diff -r "$work/profile-before" "$work/profile"

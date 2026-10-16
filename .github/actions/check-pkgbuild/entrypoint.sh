#!/usr/bin/env bash
# shellcheck disable=SC2024
set -euo pipefail
BASE_DIR=$PWD
tmpdir=$(mktemp -d)
ctoml=$tmpdir/${INPUT_CARGOTOML:-Cargo.toml}
mpcfg=$tmpdir/${INPUT_MAKEPKGCONF:-makepkg.conf}
pkgdir=$tmpdir/${INPUT_PKGDIR:-.}
cp -r ./* "$tmpdir"
chown -R builder "$tmpdir"
cd "$tmpdir"
sync_needed=false
expected=$(yq .workspace.package.version "$ctoml")
pkgbuild=$(
    grep pkgver= "$pkgdir/PKGBUILD" |
        sed 's/^pkgver=['\''"]\?\([^'\''"]\+\)['\''"]\?/\1/' |
        cut -f1 -d' '
)
srcinfo=$(
    grep pkgver "$pkgdir/.SRCINFO" |
        sed 's/^	pkgver = //'
)
if [[ $expected != "$pkgbuild" ]] || [[ $expected != "$srcinfo" ]]; then
    sync_needed=true
fi
cd "$pkgdir"
if ! diff \
    .SRCINFO \
    <(sudo -u builder makepkg --config "$mpcfg" --printsrcinfo) \
    &>/dev/null; then
    sync_needed=true
fi
echo "sync-needed=$sync_needed" >>"$GITHUB_OUTPUT"
echo "version=$expected" >>"$GITHUB_OUTPUT"
cd "$BASE_DIR"
rm -rf "$tmpdir"

#!/usr/bin/env bash
set -euo pipefail

HASH_FILE=deps-hash.txt

if [[ ! -f $HASH_FILE ]]; then
    printf "Please run in repository root.\n" >&2
    exit 1
fi

_main() {
    local backup
    backup=$(mktemp)
    cp "$HASH_FILE" "$backup"
    trap -- "mv '$backup' '$HASH_FILE'" ERR
    trap -- "rm '$backup'" EXIT
    printf "" >"$HASH_FILE"
    local msg
    msg=$(nix build --no-link ".#default.pnpmDeps" 2>&1 >/dev/null || :)
    local hash
    hash=$(<<<"$msg" grep got: | awk '{print $2}')
    printf "%s" "$hash" >"$HASH_FILE"
    nix build --no-link ".#default.pnpmDeps" &>/dev/null
}

_main

#!/usr/bin/env bash
set -euo pipefail
if git diff --cached --quiet -- pnpm-lock.yaml; then
    exit 0
fi
if git diff --cached --quiet -- deps-hash.txt; then
    printf "pnpm dependency hash must be updated\n" >&2
    exit 1
fi

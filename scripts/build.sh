#!/usr/bin/env bash
# Builds the contract to wasm and prints the hash to compare against the chain.
set -euo pipefail
cd "$(dirname "$0")/.."

stellar contract build
WASM=target/wasm32v1-none/release/tally_links.wasm

echo
echo "artifact : $WASM"
echo "size     : $(wc -c < "$WASM" | tr -d ' ') bytes"
echo "sha256   : $(shasum -a 256 "$WASM" | cut -d' ' -f1)"

#!/usr/bin/env bash
# Regenerates the TypeScript client from the deployed spec, so the web app's
# types are the ones the chain actually enforces.
set -euo pipefail
cd "$(dirname "$0")/.."

NETWORK=${1:-testnet}
CONTRACT_ID=${2:?usage: ./scripts/bindings.sh <network> <contract-id>}

rm -rf packages/tally-client
stellar contract bindings typescript \
  --network "$NETWORK" --contract-id "$CONTRACT_ID" \
  --output-dir packages/tally-client --overwrite

rm -f packages/tally-client/package-lock.json
npm install
npm run build --workspace tally-client

#!/usr/bin/env bash
# Deploys the Tally link registry.
#
#   ./scripts/deploy.sh <network> <source-key>
#
# The contract takes no constructor arguments: it holds no funds and has no
# admin, so there is nothing to configure at deploy time.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$#" -lt 2 ]; then
  sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
  exit 64
fi

NETWORK=$1
SOURCE=$2

# Mainnet spends real XLM and cannot be undone.
if [ "$NETWORK" = "mainnet" ]; then
  echo "About to deploy to MAINNET as '$SOURCE'. This costs roughly 15 XLM in"
  echo "wasm rent and cannot be reversed."
  read -r -p "Type 'deploy mainnet' to continue: " CONFIRM
  [ "$CONFIRM" = "deploy mainnet" ] || { echo "aborted"; exit 1; }
fi

./scripts/build.sh

stellar contract deploy \
  --wasm target/wasm32v1-none/release/tally_links.wasm \
  --source "$SOURCE" --network "$NETWORK"

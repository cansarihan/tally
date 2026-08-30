#!/usr/bin/env bash
# Prints the numbers the growth report asks for, read from the chain.
#
#   ./scripts/metrics.sh <network> <contract-id> <merchant-address> [source-key]
#
# Every figure the report publishes should come from here rather than from
# memory, so a reviewer can run the same command and get the same answer.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$#" -lt 3 ]; then
  sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
  exit 64
fi

NETWORK=$1
CONTRACT=$2
MERCHANT=$3
SOURCE=${4:-$MERCHANT}

read_view() {
  stellar contract invoke --id "$CONTRACT" --source "$SOURCE" --network "$NETWORK" -- "$@" 2>/dev/null
}

TOTALS=$(read_view totals_of --merchant "$MERCHANT")
REGISTRY_LINKS=$(read_view link_count)

# Distinct payers has no counter on chain — it is derived by walking the
# payments of every link this merchant owns.
PAYERS=$(read_view links_of --merchant "$MERCHANT" --offset 0 --limit 100 \
  | node -e "
    let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      try { console.log(JSON.parse(s).map(l => l.id).join(' ')); } catch { console.log(''); }
    })")

SEEN=""
for ID in $PAYERS; do
  SEEN="$SEEN $(read_view payments_of --id "$ID" --offset 0 --limit 100 \
    | node -e "
      let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
        try { console.log(JSON.parse(s).map(p => p.payer).join(' ')); } catch { console.log(''); }
      })")"
done
DISTINCT=$(printf '%s\n' $SEEN | sed '/^$/d' | sort -u | wc -l | tr -d ' ')

echo "network            : $NETWORK"
echo "registry           : $CONTRACT"
echo "merchant           : $MERCHANT"
echo "links in registry  : $REGISTRY_LINKS"
echo "merchant totals    : $TOTALS"
echo "distinct payers    : $DISTINCT"

# Volume is per token. Override with TALLY_TOKENS="C... C..." for a merchant
# who takes more than one asset.
TOKENS=${TALLY_TOKENS:-CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC}
for TOKEN in $TOKENS; do
  echo "volume             : $(read_view volume_of --merchant "$MERCHANT" --token "$TOKEN") ($TOKEN)"
done

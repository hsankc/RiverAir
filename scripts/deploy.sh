#!/usr/bin/env bash
#
# Build and deploy the mission escrow to Stellar testnet, then write the
# resulting contract id into .env.local so the frontend picks it up.
#
#   ./scripts/deploy.sh
#
# Re-running deploys a fresh contract; the old one stays on chain untouched.

set -euo pipefail

cd "$(dirname "$0")/.."

IDENTITY="${RIVERAIR_IDENTITY:-riverair-deployer}"
NETWORK="testnet"

# The anchor's USDC, as a contract. This is the asset a SEP-6 deposit pays out,
# so it is the only one the escrow can hold.
USDC_SAC="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"

# Reflector's external feed. It carries USDC on testnet; the fiat feed does not
# carry TRY there, which is why the lira rate arrives via SEP-38 instead.
ORACLE="CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63"
ORACLE_ASSET="USDC"

# Refuse to settle against a price older than 15 minutes (the feed updates on a
# 300 s cadence), or one more than 2% off the dollar peg.
MAX_PRICE_AGE=900
DEPEG_BPS=200

say() { printf '\n\033[1;35m▸ %s\033[0m\n' "$1"; }

say "Checking the toolchain"
stellar --version | head -1
rustup target list --installed | grep -q wasm32v1-none \
  || rustup target add wasm32v1-none

say "Building the contract"
# The Cargo workspace lives in contracts/, not at the repo root.
#
# `stellar contract build` runs its own optimization pass, and on this toolchain
# that pass fails with "Failed to read module" on a wasm it just emitted. The
# standalone optimizer reads the identical file without complaint, so the build
# and the optimize are run as separate steps.
(cd contracts && stellar contract build --optimize=false)

RAW="contracts/target/wasm32v1-none/release/mission_escrow.wasm"
[ -f "$RAW" ] || { echo "Could not find the built wasm at $RAW" >&2; exit 1; }

stellar contract optimize --wasm "$RAW" >/dev/null 2>&1 || true
WASM="contracts/target/wasm32v1-none/release/mission_escrow.optimized.wasm"
[ -f "$WASM" ] || WASM="$RAW"
printf '  %s (%s bytes)\n' "$WASM" "$(wc -c < "$WASM")"

say "Preparing the deployer identity"
if ! stellar keys address "$IDENTITY" >/dev/null 2>&1; then
  stellar keys generate --global "$IDENTITY" --network "$NETWORK" --fund
else
  # Top up in case an earlier run drained it.
  stellar keys fund "$IDENTITY" --network "$NETWORK" >/dev/null 2>&1 || true
fi
ADMIN="$(stellar keys address "$IDENTITY")"
printf '  admin: %s\n' "$ADMIN"

say "Deploying"
CONTRACT_ID="$(stellar contract deploy \
  --wasm "$WASM" \
  --source-account "$IDENTITY" \
  --network "$NETWORK" \
  -- \
  --admin "$ADMIN" \
  --usdc "$USDC_SAC" \
  --oracle "$ORACLE" \
  --oracle_asset "$ORACLE_ASSET" \
  --max_price_age "$MAX_PRICE_AGE" \
  --depeg_bps "$DEPEG_BPS")"

printf '  contract: %s\n' "$CONTRACT_ID"

say "Reading the oracle through the deployed contract"
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$IDENTITY" \
  --network "$NETWORK" \
  --send=no \
  -- oracle_health || echo "  (the feed is unhealthy right now — settlement would be refused)"

say "Writing .env.local"
touch .env.local
grep -v '^NEXT_PUBLIC_MISSION_ESCROW_ID=' .env.local > .env.local.tmp || true
mv .env.local.tmp .env.local
printf 'NEXT_PUBLIC_MISSION_ESCROW_ID=%s\n' "$CONTRACT_ID" >> .env.local

cat <<EOF

Deployed.

  Contract   $CONTRACT_ID
  Explorer   https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID
  Admin      $ADMIN

Restart \`npm run dev\` so Next.js picks up the new environment variable.
EOF

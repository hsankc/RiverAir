/**
 * Network, asset and contract addresses for RiverAir.
 *
 * Everything here is Stellar testnet. Moving to mainnet means changing the
 * network block, the USDC issuer, the anchor home domain and the Reflector
 * feed — the call sites do not change.
 */

export const NETWORK = {
  name: "Stellar Testnet",
  passphrase: "Test SDF Network ; September 2015",
  horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org",
  rpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC ?? "https://soroban-testnet.stellar.org",
  friendbotUrl: "https://friendbot.stellar.org",
  explorerUrl: "https://stellar.expert/explorer/testnet",
} as const;

/** XLM, for fees and reserves. Native assets carry no issuer. */
export const XLM = {
  code: "XLM",
  decimals: 7,
} as const;

/**
 * USDC as issued on testnet by the account the anchor settles in. This is the
 * asset users actually receive from a SEP-6 deposit, so it is the only USDC
 * the escrow accepts.
 *
 * Note this is *not* the USDC held by DeFindex's testnet vaults, which is
 * issued by GATALTGT… — the two are separate assets with no path between them
 * on testnet. See README for why the yield leg is deferred.
 */
export const USDC = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  /** Stellar Asset Contract for the same asset, for Soroban calls. */
  contractId: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  decimals: 7,
} as const;

/**
 * The TRY on/off-ramp. Every endpoint (auth, deposit, withdraw, quotes) is
 * discovered from this domain's stellar.toml rather than hardcoded, which is
 * what makes the integration portable to a production anchor.
 */
export const ANCHOR = {
  homeDomain: process.env.NEXT_PUBLIC_ANCHOR_HOME_DOMAIN ?? "tr-mock-anchor.fly.dev",
  assetCode: "USDC",
} as const;

/**
 * Reflector price feeds on testnet.
 *
 * The escrow reads `externalFeed` to check USDC against its dollar peg before
 * settling. The fiat feed is listed for completeness but carries no TRY on
 * testnet — TRY lives only on the mainnet fiat feed, so the lira rate reaches
 * us through the anchor's SEP-38 quote instead (which Reflector also sources).
 */
export const REFLECTOR = {
  externalFeed: "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63",
  fiatFeed: "CCSSOHTBL3LEWUCBBEB5NJFC2OKFRC74OWEIJIZLRJBGAAU4VMU5NV4W",
  /** The feed quotes against USD at 14 decimals on a 300 s cadence. */
  decimals: 14,
  resolutionSeconds: 300,
  settlementAsset: "USDC",
} as const;

/** Set once the escrow is deployed; see `scripts/deploy.sh`. */
export const MISSION_ESCROW_ID = process.env.NEXT_PUBLIC_MISSION_ESCROW_ID ?? "";

export function explorerTx(hash: string): string {
  return `${NETWORK.explorerUrl}/tx/${hash}`;
}

export function explorerAccount(address: string): string {
  return `${NETWORK.explorerUrl}/account/${address}`;
}

export function explorerContract(contractId: string): string {
  return `${NETWORK.explorerUrl}/contract/${contractId}`;
}

/** Stroops-style integer (7dp) to a human string. */
export function fromUnits(amount: bigint | string | number, decimals = 7): string {
  const n = BigInt(amount);
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  const frac = (n < 0n ? -n : n) % base;
  return `${whole}.${frac.toString().padStart(decimals, "0")}`;
}

/** Human decimal string to a 7dp integer. */
export function toUnits(amount: string | number, decimals = 7): bigint {
  const [whole, frac = ""] = String(amount).split(".");
  const padded = frac.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

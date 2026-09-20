"use client";

/**
 * Client for the mission escrow contract.
 *
 * Bindings are read off the deployed contract's own spec at runtime rather
 * than checked in, so the types here can never drift from what is actually on
 * chain. Read-only calls stop at simulation and cost nothing; anything that
 * moves USDC is assembled, signed by the user's wallet, and submitted.
 */

import { MISSION_ESCROW_ID, NETWORK } from "./config";

export type MissionStatus = "Open" | "Assigned" | "Completed" | "Cancelled";

export interface EscrowMission {
  id: number;
  client: string;
  operator: string | null;
  amount: bigint;
  try_amount: bigint;
  quote_rate: bigint;
  status: MissionStatus;
  created_at: bigint;
  deadline: bigint;
  proof: Buffer | null;
}

export interface OracleReading {
  price: bigint;
  timestamp: bigint;
}

/**
 * The escrow's own settings, read from the deployed contract rather than
 * duplicated here. The two that matter for settlement are `max_price_age` and
 * `depeg_bps`: they are the thresholds `complete()` measures a price against
 * before it releases anything.
 */
export interface EscrowConfig {
  admin: string;
  usdc: string;
  oracle: string;
  oracle_asset: string;
  max_price_age: bigint;
  depeg_bps: number;
}

/** Signer shape the SDK's contract client expects. */
export type SignXdr = (
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string },
) => Promise<{ signedTxXdr: string; signerAddress?: string }>;

export class EscrowNotDeployed extends Error {
  constructor() {
    super(
      "The mission escrow is not deployed yet. Run scripts/deploy.sh and set NEXT_PUBLIC_MISSION_ESCROW_ID.",
    );
    this.name = "EscrowNotDeployed";
  }
}

/**
 * Reflector's errors are the ones a user is most likely to hit, so they get
 * sentences rather than codes. The rest fall through to the raw message.
 */
export function explainEscrowError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);

  if (/#10\b|StalePrice/.test(raw)) {
    return "The price feed has gone quiet, so the payout is on hold. Funds stay in escrow until Reflector reports a fresh price.";
  }
  if (/#11\b|Depegged/.test(raw)) {
    return "USDC has drifted off its dollar peg beyond the contract's tolerance. Settlement is paused rather than paying out at an unreliable rate.";
  }
  if (/#9\b|NoPrice/.test(raw)) {
    return "The price feed returned nothing for USDC. Settlement cannot clear without it.";
  }
  if (/#4\b|WrongStatus/.test(raw)) {
    return "This mission is not in a state that allows that — it may already be settled or cancelled.";
  }
  if (/#3\b|MissionNotFound/.test(raw)) {
    return "No mission with that id exists on chain. Simulated board missions are not funded into the escrow — post one from the panel on the right to work against a real one.";
  }
  if (/#5\b|NotOperator/.test(raw)) {
    return "This mission has no operator assigned, so there is nobody to pay.";
  }
  if (/#6\b|NotAuthorized/.test(raw)) {
    return "Only the operator who claimed this mission can settle it, and the signature did not match.";
  }
  if (/#1\b|NotInitialized/.test(raw)) {
    return "The escrow has not been initialised. Run scripts/deploy.sh against this contract id.";
  }
  if (/#8\b|DeadlinePassed/.test(raw)) {
    return "This mission's deadline has passed.";
  }
  if (/#2\b|MissionExists/.test(raw)) {
    return "A mission with that id is already funded.";
  }
  if (/#7\b|InvalidAmount/.test(raw)) {
    return "That amount is not payable.";
  }
  if (/trustline|op_no_trust/i.test(raw)) {
    return "Your account has no USDC trustline yet. Add one before funding a mission.";
  }
  if (/insufficient|underfunded|op_underfunded/i.test(raw)) {
    return "Not enough USDC in your wallet to cover this mission.";
  }
  return raw;
}

type AnyClient = {
  [method: string]: (...args: unknown[]) => Promise<{
    result: unknown;
    signAndSend: (opts?: { signTransaction?: SignXdr }) => Promise<{
      result: unknown;
      getTransactionResponse?: { txHash?: string };
      sendTransactionResponse?: { hash?: string };
    }>;
  }>;
};

/**
 * Every contract function here returns `Result<T, Error>`, and the SDK hands
 * that back wrapped as `Ok { value }` or `Err { error }` rather than as the
 * value itself. `unwrap()` gives the value or throws the contract's own error,
 * which is what `explainEscrowError` reads.
 */
function unwrap<T>(result: unknown): T {
  if (result && typeof (result as { unwrap?: unknown }).unwrap === "function") {
    return (result as { unwrap: () => T }).unwrap();
  }
  return result as T;
}

let cached: { key: string; client: AnyClient } | null = null;

async function getClient(publicKey?: string, signTransaction?: SignXdr): Promise<AnyClient> {
  if (!MISSION_ESCROW_ID) throw new EscrowNotDeployed();

  const key = `${publicKey ?? "readonly"}`;
  if (cached?.key === key) return cached.client;

  const { contract } = await import("@stellar/stellar-sdk");
  const client = (await contract.Client.from({
    contractId: MISSION_ESCROW_ID,
    networkPassphrase: NETWORK.passphrase,
    rpcUrl: NETWORK.rpcUrl,
    publicKey,
    signTransaction: signTransaction as never,
  })) as unknown as AnyClient;

  cached = { key, client };
  return client;
}

function settled(sent: {
  result: unknown;
  getTransactionResponse?: { txHash?: string };
  sendTransactionResponse?: { hash?: string };
}): string {
  // Throws if the contract refused, e.g. a stale oracle on `complete`.
  unwrap(sent.result);
  return sent.getTransactionResponse?.txHash ?? sent.sendTransactionResponse?.hash ?? "";
}

// --------------------------------------------------------------- read-only

/** What `complete` would see right now. Errors describe why it would refuse. */
export async function readOracleHealth(): Promise<OracleReading> {
  const client = await getClient();
  const tx = await client.oracle_health();
  return unwrap<OracleReading>(tx.result);
}

export async function readMission(id: number): Promise<EscrowMission> {
  const client = await getClient();
  const tx = await client.get_mission({ id });
  return unwrap<EscrowMission>(tx.result);
}

export async function readConfig(): Promise<EscrowConfig> {
  const client = await getClient();
  const tx = await client.get_config();
  return unwrap<EscrowConfig>(tx.result);
}

// -------------------------------------------------------------- write path

/**
 * Lock a mission's payment. The customer signs twice over in one flow: once
 * authorising the USDC transfer, once for the invocation itself — the wallet
 * presents this as a single approval.
 */
export async function fundMission(
  params: {
    id: number;
    client: string;
    amount: bigint;
    tryAmount: bigint;
    quoteRate: bigint;
    deadline: bigint;
  },
  signTransaction: SignXdr,
): Promise<string> {
  const escrow = await getClient(params.client, signTransaction);
  const tx = await escrow.fund_mission({
    id: params.id,
    client: params.client,
    amount: params.amount,
    try_amount: params.tryAmount,
    quote_rate: params.quoteRate,
    deadline: params.deadline,
  });
  return settled(await tx.signAndSend({ signTransaction }));
}

/** An operator claims an open mission. */
export async function assignMission(
  params: { id: number; operator: string },
  signTransaction: SignXdr,
): Promise<string> {
  const escrow = await getClient(params.operator, signTransaction);
  const tx = await escrow.assign({ id: params.id, operator: params.operator });
  return settled(await tx.signAndSend({ signTransaction }));
}

/**
 * Settle a flown mission against its flight record. The contract reads
 * Reflector before releasing anything, so this can fail for reasons that have
 * nothing to do with the operator — see `explainEscrowError`.
 */
export async function completeMission(
  params: { id: number; operator: string; proof: Uint8Array },
  signTransaction: SignXdr,
): Promise<string> {
  const escrow = await getClient(params.operator, signTransaction);
  const tx = await escrow.complete({ id: params.id, proof: Buffer.from(params.proof) });
  return settled(await tx.signAndSend({ signTransaction }));
}

export async function cancelMission(
  params: { id: number; caller: string },
  signTransaction: SignXdr,
): Promise<string> {
  const escrow = await getClient(params.caller, signTransaction);
  const tx = await escrow.cancel({ id: params.id });
  return settled(await tx.signAndSend({ signTransaction }));
}

/**
 * The 32 bytes `complete()` stores against a settled mission.
 *
 * On a real aircraft this is the digest of a telemetry log signed at the edge
 * with the drone's Ed25519 key. Here it is the digest of what the simulation
 * actually flew — same shape, same place in the contract, so the attachment
 * point is real even though the signature is not yet.
 */
export async function flightRecordHash(record: {
  missionId: number;
  drone: string;
  from: [number, number];
  to: [number, number];
  flownAt: number;
}): Promise<Uint8Array> {
  const canonical = [
    `mission:${record.missionId}`,
    `drone:${record.drone}`,
    `from:${record.from[0].toFixed(6)},${record.from[1].toFixed(6)}`,
    `to:${record.to[0].toFixed(6)},${record.to[1].toFixed(6)}`,
    `flown_at:${record.flownAt}`,
  ].join("|");

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return new Uint8Array(digest);
}

// ------------------------------------------------------------------ pricing

/**
 * USDC owed for a lira amount at a SEP-38 rate, mirroring the contract's own
 * `settlement_usdc` so the figure on screen is the figure that settles.
 * `tryAmount` is 2dp, `quoteRate` is TRY-per-USDC scaled 1e7, result is 7dp.
 */
export function settlementUsdc(tryAmount: bigint, quoteRate: bigint): bigint {
  if (tryAmount <= 0n || quoteRate <= 0n) throw new Error("Amount must be positive");
  return (tryAmount * 1_000_000_000_000n) / quoteRate;
}

/** A SEP-38 decimal rate string to the contract's 1e7-scaled integer. */
export function rateToScaled(rate: string): bigint {
  const [whole, frac = ""] = rate.split(".");
  return BigInt(whole || "0") * 10_000_000n + BigInt(frac.padEnd(7, "0").slice(0, 7) || "0");
}

/** A lira amount like "250.50" to the contract's 2dp integer. */
export function tryToScaled(amount: string | number): bigint {
  const [whole, frac = ""] = String(amount).split(".");
  return BigInt(whole || "0") * 100n + BigInt(frac.padEnd(2, "0").slice(0, 2) || "0");
}

/**
 * SEP client for the TRY on/off-ramp.
 *
 * Nothing here hardcodes an anchor endpoint. Everything is discovered from the
 * home domain's stellar.toml (SEP-1), which is what lets the same code point at
 * a production anchor by changing one string.
 *
 * Written against plain `fetch` rather than a wallet SDK for two reasons: the
 * SDK's SEP-10 helper wants the user's secret key, which a non-custodial app
 * never has, and its browserify-era dependencies do not bundle cleanly under
 * Next.js. Challenge signing happens in the browser through the user's wallet;
 * this module only moves bytes.
 *
 * SEPs in play: 1 (discovery), 10 (auth), 6 (deposit/withdraw), 12 (KYC),
 * 38 (quotes). See `.claude/skills/standards/SKILL.md` for the standards map.
 */

import { ANCHOR } from "./config";

export interface AnchorToml {
  WEB_AUTH_ENDPOINT: string;
  TRANSFER_SERVER: string;
  KYC_SERVER?: string;
  ANCHOR_QUOTE_SERVER?: string;
  SIGNING_KEY: string;
  NETWORK_PASSPHRASE: string;
  currencies: Array<{ code: string; issuer: string }>;
}

export interface DepositInstructions {
  id: string;
  /** Human-readable bank details: IBAN, account name, reference to quote. */
  how?: string;
  instructions?: Record<string, { value: string; description: string }>;
  eta?: number;
  min_amount?: number;
  max_amount?: number;
  fee_percent?: number;
  extra_info?: { message?: string };
}

export interface WithdrawInstructions {
  id: string;
  /** Treasury address to send USDC to. */
  account_id: string;
  memo: string;
  memo_type: string;
  fee_percent?: number;
  extra_info?: { message?: string };
}

export interface AnchorTransaction {
  id: string;
  kind: "deposit" | "withdrawal";
  status: string;
  status_eta?: number;
  amount_in?: string;
  amount_out?: string;
  amount_fee?: string;
  started_at?: string;
  completed_at?: string;
  stellar_transaction_id?: string;
  external_transaction_id?: string;
  more_info_url?: string;
  to?: string;
  from?: string;
  withdraw_memo?: string;
  withdraw_anchor_account?: string;
}

export interface Sep38Price {
  /** SEP-38's mid rate, before the anchor's fee. */
  price: string;
  /** The rate actually delivered, fee included. This is the one to convert with. */
  total_price?: string;
  sell_amount: string;
  buy_amount: string;
  fee?: { total: string; asset: string };
}

export interface Sep38Quote extends Sep38Price {
  id: string;
  expires_at: string;
  sell_asset: string;
  buy_asset: string;
}

/**
 * Lira per USDC, whichever way round the quote was asked.
 *
 * Two traps live in SEP-38's `price` field and both are silent. It is the mid
 * rate, so it flatters the customer by the spread — `total_price` is what they
 * actually get. And it is quoted as "one unit of buy_asset priced in
 * sell_asset", so it inverts between a deposit and a withdrawal: 49.03 one way,
 * 0.0206 the other.
 *
 * Deriving it from `sell_amount` and `buy_amount` sidesteps both. Those are
 * concrete amounts, already fee-inclusive, and unambiguous about direction, so
 * every caller can use one rule: TRY = USDC × rate.
 */
export function tryPerUsdc(quote: Sep38Price, tryIsSellSide: boolean): string {
  const sell = Number(quote.sell_amount);
  const buy = Number(quote.buy_amount);

  if (sell > 0 && buy > 0) {
    return (tryIsSellSide ? sell / buy : buy / sell).toFixed(7);
  }

  // No amounts came back — fall back to the quoted price, inverting when the
  // lira is the asset being bought.
  const price = Number(quote.total_price ?? quote.price);
  return (tryIsSellSide ? price : 1 / price).toFixed(7);
}

export class AnchorError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
  ) {
    super(message);
    this.name = "AnchorError";
  }
}

const TOML_TTL_MS = 5 * 60 * 1000;
let tomlCache: { at: number; value: AnchorToml } | null = null;

/** Minimal TOML reader — enough for the handful of keys SEP-1 defines. */
function parseToml(text: string): AnchorToml {
  const flat: Record<string, string> = {};
  const currencies: Array<{ code: string; issuer: string }> = [];
  let current: Record<string, string> | null = null;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    if (line === "[[CURRENCIES]]") {
      current = {};
      const entry = current;
      currencies.push(entry as unknown as { code: string; issuer: string });
      continue;
    }
    if (line.startsWith("[")) {
      current = null;
      continue;
    }

    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (current) current[key] = value;
    else flat[key] = value;
  }

  return {
    WEB_AUTH_ENDPOINT: flat.WEB_AUTH_ENDPOINT,
    TRANSFER_SERVER: flat.TRANSFER_SERVER,
    KYC_SERVER: flat.KYC_SERVER,
    ANCHOR_QUOTE_SERVER: flat.ANCHOR_QUOTE_SERVER,
    SIGNING_KEY: flat.SIGNING_KEY,
    NETWORK_PASSPHRASE: flat.NETWORK_PASSPHRASE,
    currencies,
  };
}

/** SEP-1 discovery. Cached briefly so a demo does not re-fetch per click. */
export async function getToml(homeDomain = ANCHOR.homeDomain): Promise<AnchorToml> {
  if (tomlCache && Date.now() - tomlCache.at < TOML_TTL_MS) return tomlCache.value;

  const url = `https://${homeDomain}/.well-known/stellar.toml`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new AnchorError(`stellar.toml unreachable`, res.status, url);

  const value = parseToml(await res.text());
  if (!value.WEB_AUTH_ENDPOINT || !value.TRANSFER_SERVER) {
    throw new AnchorError("stellar.toml is missing SEP endpoints", 502, url);
  }

  tomlCache = { at: Date.now(), value };
  return value;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.text();

  if (!res.ok) {
    let message = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* keep the raw body */
    }
    throw new AnchorError(message, res.status, url);
  }

  return JSON.parse(body) as T;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// ------------------------------------------------------------------ SEP-10

/**
 * Step one of login: the anchor hands back a transaction to sign. The user's
 * key is the identity — there is no password and no account to create.
 */
export async function getChallenge(account: string): Promise<{
  transaction: string;
  network_passphrase: string;
}> {
  const toml = await getToml();
  return json(`${toml.WEB_AUTH_ENDPOINT}?account=${encodeURIComponent(account)}`);
}

/** Step two: hand back the signed challenge, receive a session token. */
export async function submitChallenge(signedXdr: string): Promise<{ token: string }> {
  const toml = await getToml();
  return json(toml.WEB_AUTH_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transaction: signedXdr }),
  });
}

// ------------------------------------------------------------------- SEP-6

export async function getInfo(): Promise<unknown> {
  const toml = await getToml();
  return json(`${toml.TRANSFER_SERVER}/info`);
}

/** Start a TRY → USDC deposit. Returns the bank details to pay against. */
export async function startDeposit(
  token: string,
  params: { account: string; amount?: string; quoteId?: string },
): Promise<DepositInstructions> {
  const toml = await getToml();
  const query = new URLSearchParams({
    asset_code: ANCHOR.assetCode,
    account: params.account,
    funding_method: "bank_account",
    type: "bank_account",
  });
  if (params.amount) query.set("amount", params.amount);
  if (params.quoteId) query.set("quote_id", params.quoteId);

  return json(`${toml.TRANSFER_SERVER}/deposit?${query}`, { headers: auth(token) });
}

/** Start a USDC → TRY withdrawal. Returns where to send USDC and which memo. */
export async function startWithdraw(
  token: string,
  params: { amount?: string; quoteId?: string },
): Promise<WithdrawInstructions> {
  const toml = await getToml();
  const query = new URLSearchParams({
    asset_code: ANCHOR.assetCode,
    type: "bank_account",
    funding_method: "bank_account",
  });
  if (params.amount) query.set("amount", params.amount);
  if (params.quoteId) query.set("quote_id", params.quoteId);

  return json(`${toml.TRANSFER_SERVER}/withdraw?${query}`, { headers: auth(token) });
}

export async function getTransaction(
  token: string,
  id: string,
): Promise<{ transaction: AnchorTransaction }> {
  const toml = await getToml();
  return json(`${toml.TRANSFER_SERVER}/transaction?id=${encodeURIComponent(id)}`, {
    headers: auth(token),
  });
}

export async function listTransactions(
  token: string,
): Promise<{ transactions: AnchorTransaction[] }> {
  const toml = await getToml();
  return json(`${toml.TRANSFER_SERVER}/transactions?asset_code=${ANCHOR.assetCode}`, {
    headers: auth(token),
  });
}

/**
 * Sandbox only: stands in for the customer's bank actually sending the lira.
 * On a production anchor the incoming transfer does this and the endpoint does
 * not exist.
 */
export async function simulateBankTransfer(id: string, amount: string): Promise<unknown> {
  const toml = await getToml();
  return json(`${toml.TRANSFER_SERVER}/tx/${encodeURIComponent(id)}/simulate-bank-transfer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount }),
  });
}

// ------------------------------------------------------------------ SEP-38

export const TRY_ASSET = "iso4217:TRY";
export const usdcAsset = (issuer: string) => `stellar:${ANCHOR.assetCode}:${issuer}`;

/** Indicative rate, no commitment. Used to price a mission as the user types. */
export async function getPrice(params: {
  sellAsset: string;
  buyAsset: string;
  sellAmount?: string;
  buyAmount?: string;
}): Promise<Sep38Price> {
  const toml = await getToml();
  if (!toml.ANCHOR_QUOTE_SERVER) {
    throw new AnchorError("anchor does not offer SEP-38 quotes", 501, toml.TRANSFER_SERVER);
  }

  const query = new URLSearchParams({
    sell_asset: params.sellAsset,
    buy_asset: params.buyAsset,
    context: "sep6",
  });
  if (params.sellAmount) query.set("sell_amount", params.sellAmount);
  if (params.buyAmount) query.set("buy_amount", params.buyAmount);
  if (params.sellAsset === TRY_ASSET) query.set("sell_delivery_method", "bank_account");
  if (params.buyAsset === TRY_ASSET) query.set("buy_delivery_method", "bank_account");

  return json(`${toml.ANCHOR_QUOTE_SERVER}/price?${query}`);
}

/**
 * Firm quote. The rate is held for `expires_at`, and the id is what ties a
 * mission's escrowed USDC back to the lira figure the customer agreed to.
 */
export async function createQuote(
  token: string,
  params: {
    sellAsset: string;
    buyAsset: string;
    sellAmount?: string;
    buyAmount?: string;
  },
): Promise<Sep38Quote> {
  const toml = await getToml();
  if (!toml.ANCHOR_QUOTE_SERVER) {
    throw new AnchorError("anchor does not offer SEP-38 quotes", 501, toml.TRANSFER_SERVER);
  }

  const body: Record<string, string> = {
    sell_asset: params.sellAsset,
    buy_asset: params.buyAsset,
    context: "sep6",
  };
  if (params.sellAmount) body.sell_amount = params.sellAmount;
  if (params.buyAmount) body.buy_amount = params.buyAmount;
  if (params.sellAsset === TRY_ASSET) body.sell_delivery_method = "bank_account";
  if (params.buyAsset === TRY_ASSET) body.buy_delivery_method = "bank_account";

  return json(`${toml.ANCHOR_QUOTE_SERVER}/quote`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth(token) },
    body: JSON.stringify(body),
  });
}

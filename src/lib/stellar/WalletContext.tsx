"use client";

/**
 * Wallet session for RiverAir.
 *
 * The user's Stellar key is the identity everywhere: it signs transactions, and
 * it signs the SEP-10 challenge that logs them into the anchor. There is no
 * account to create and no password to store — `authToken` below is a session
 * token the anchor issued against a signature, held in memory only.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NETWORK, USDC, XLM } from "./config";

interface Balances {
  xlm: string;
  usdc: string;
  hasUsdcTrustline: boolean;
  /** Reserve-aware spendable XLM, so the UI can warn before the ledger does. */
  spendableXlm: string;
  /**
   * Whether the account exists on this network at all. A brand-new Freighter
   * key does not until something funds it, and an account that is not there
   * cannot be loaded, cannot hold a trustline and cannot be paid a deposit.
   * Without this flag that state is indistinguishable from a funded account
   * holding zero, and every button downstream fails with a bare 404.
   */
  exists: boolean;
}

interface WalletState {
  address: string | null;
  isConnecting: boolean;
  balances: Balances;
  /** Anchor session from SEP-10, null until the user logs into the ramp. */
  authToken: string | null;
  isAuthenticating: boolean;
  error: string | null;
}

interface WalletApi extends WalletState {
  /** Pass a wallet id to go straight to it; omit it for the picker. */
  connect: (walletId?: string) => Promise<void>;
  /** True once we know Freighter is installed in this browser. */
  freighterReady: boolean;
  disconnect: () => Promise<void>;
  /** Sign and hand back the XDR, for transactions we submit to Horizon ourselves. */
  signXdr: (xdr: string) => Promise<string>;
  /**
   * The same signature in the shape the SDK's contract client expects. Soroban
   * invocations go through this so the SDK can assemble auth entries itself.
   */
  signForContract: (
    xdr: string,
    opts?: { networkPassphrase?: string; address?: string },
  ) => Promise<{ signedTxXdr: string; signerAddress?: string }>;
  refresh: () => Promise<void>;
  /** Sign the anchor's SEP-10 challenge and hold the resulting session. */
  authenticate: () => Promise<string>;
  addUsdcTrustline: () => Promise<string>;
  /**
   * Ask Friendbot to create and fund the account. Testnet only, free, and the
   * first step for any key that has never been used here — without it there is
   * no account to add a trustline to.
   */
  fundWithFriendbot: () => Promise<void>;
}

const EMPTY_BALANCES: Balances = {
  xlm: "0",
  usdc: "0",
  hasUsdcTrustline: false,
  spendableXlm: "0",
  exists: false,
};

const WalletContext = createContext<WalletApi | null>(null);

const STORAGE_KEY = "riverair.wallet.address";

export const FREIGHTER = "freighter";
export const FREIGHTER_INSTALL = "https://www.freighter.app/";

/** The kit touches `window`, so it is only ever loaded in the browser. */
async function kit() {
  const [{ StellarWalletsKit, Networks }, { defaultModules }] = await Promise.all([
    import("@creit.tech/stellar-wallets-kit"),
    import("@creit.tech/stellar-wallets-kit/modules/utils"),
  ]);

  if (!kitReady) {
    StellarWalletsKit.init({ modules: defaultModules(), network: Networks.TESTNET });
    // The kit ships a white modal. It is only the fallback path here, but it
    // should still look like the rest of the panel when someone opens it.
    StellarWalletsKit.setTheme({
      background: "#121a21",
      "background-secondary": "#1a242d",
      "foreground-strong": "#e9eff4",
      foreground: "#a9bcc8",
      "foreground-secondary": "#6b8090",
      primary: "#ffb000",
      "primary-foreground": "#1a1206",
      transparent: "transparent",
      lighter: "#243039",
      light: "#1a242d",
      "light-gray": "#2e3d49",
      gray: "#6b8090",
      danger: "#ff5252",
      border: "#2e3d49",
      shadow: "rgba(0, 0, 0, 0.55)",
      "border-radius": "2px",
      "font-family": "'IBM Plex Sans', system-ui, sans-serif",
    });
    kitReady = true;
  }
  return StellarWalletsKit;
}
let kitReady = false;

interface HorizonBalance {
  balance: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
}

async function loadBalances(address: string): Promise<Balances> {
  const res = await fetch(`${NETWORK.horizonUrl}/accounts/${address}`, {
    cache: "no-store",
  });

  // An account that has never been funded simply does not exist yet.
  if (res.status === 404) return EMPTY_BALANCES;
  if (!res.ok) throw new Error(`Horizon returned ${res.status}`);

  const account = (await res.json()) as {
    balances: HorizonBalance[];
    subentry_count: number;
  };

  const native = account.balances.find((b) => b.asset_type === "native");
  const usdc = account.balances.find(
    (b) => b.asset_code === USDC.code && b.asset_issuer === USDC.issuer,
  );

  // Each subentry locks half an XLM, plus the two-unit account base.
  const reserved = (2 + account.subentry_count) * 0.5;
  const xlm = Number(native?.balance ?? 0);

  return {
    xlm: (native?.balance ?? "0").replace(/0+$/, "").replace(/\.$/, ""),
    usdc: usdc?.balance ?? "0",
    hasUsdcTrustline: Boolean(usdc),
    spendableXlm: Math.max(0, xlm - reserved).toFixed(XLM.decimals),
    exists: true,
  };
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [balances, setBalances] = useState<Balances>(EMPTY_BALANCES);
  const [error, setError] = useState<string | null>(null);
  const [freighterReady, setFreighterReady] = useState(false);

  // Guards an in-flight SEP-10 handshake so two callers share one signature.
  const authInFlight = useRef<Promise<string> | null>(null);

  const refresh = useCallback(async () => {
    if (!address) return;
    try {
      setBalances(await loadBalances(address));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read balances");
    }
  }, [address]);

  /**
   * With a wallet id this goes straight to that extension — one click, no
   * chooser. Without one it falls back to the kit's picker, which is there for
   * anyone not on Freighter.
   */
  const connect = useCallback(async (walletId?: string) => {
    setIsConnecting(true);
    setError(null);
    try {
      const k = await kit();
      let picked: string;

      if (walletId) {
        k.setWallet(walletId);
        picked = (await k.fetchAddress()).address;
      } else {
        picked = (await k.authModal()).address;
      }

      setAddress(picked);
      localStorage.setItem(STORAGE_KEY, picked);
      setBalances(await loadBalances(picked));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Dismissing the extension prompt is a normal thing to do.
      if (/closed|dismiss|cancel|denied|reject/i.test(message)) return;
      if (/not (installed|available|found)|undefined/i.test(message)) {
        setError("Freighter isn't available in this browser.");
        return;
      }
      setError(message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      const k = await kit();
      await k.disconnect();
    } catch {
      /* the session is going away regardless */
    }
    localStorage.removeItem(STORAGE_KEY);
    setAddress(null);
    setAuthToken(null);
    setBalances(EMPTY_BALANCES);
    setError(null);
  }, []);

  const signForContract = useCallback(
    async (xdr: string, opts?: { networkPassphrase?: string; address?: string }) => {
      if (!address) throw new Error("Connect a wallet first");
      const k = await kit();
      return k.signTransaction(xdr, {
        networkPassphrase: opts?.networkPassphrase ?? NETWORK.passphrase,
        address: opts?.address ?? address,
      });
    },
    [address],
  );

  const signXdr = useCallback(
    async (xdr: string) => (await signForContract(xdr)).signedTxXdr,
    [signForContract],
  );

  /**
   * SEP-10: fetch a challenge, sign it, trade it for a session token. The
   * anchor never sees a key — only a signature over its own challenge.
   */
  const authenticate = useCallback(async () => {
    if (!address) throw new Error("Connect a wallet first");
    if (authToken) return authToken;
    if (authInFlight.current) return authInFlight.current;

    const run = (async () => {
      setIsAuthenticating(true);
      try {
        const challengeRes = await fetch("/api/anchor/challenge", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ account: address }),
        });
        if (!challengeRes.ok) throw new Error(await challengeRes.text());
        const { transaction } = (await challengeRes.json()) as { transaction: string };

        const signed = await signXdr(transaction);

        const tokenRes = await fetch("/api/anchor/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transaction: signed }),
        });
        if (!tokenRes.ok) throw new Error(await tokenRes.text());
        const { token } = (await tokenRes.json()) as { token: string };

        setAuthToken(token);
        return token;
      } finally {
        setIsAuthenticating(false);
        authInFlight.current = null;
      }
    })();

    authInFlight.current = run;
    return run;
  }, [address, authToken, signXdr]);

  /**
   * USDC needs a trustline before the anchor can pay a deposit out. Without
   * one the anchor parks the deposit in `pending_trust`.
   */
  const fundWithFriendbot = useCallback(async () => {
    if (!address) throw new Error("Connect a wallet first");

    const res = await fetch(`${NETWORK.friendbotUrl}/?addr=${address}`);
    // Friendbot answers 400 for an account it has already funded, which is not
    // a failure from here — the account exists either way.
    if (!res.ok && res.status !== 400) {
      throw new Error(`Friendbot returned ${res.status}. Try again in a moment.`);
    }
    await refresh();
  }, [address, refresh]);

  const addUsdcTrustline = useCallback(async () => {
    if (!address) throw new Error("Connect a wallet first");

    const { Asset, BASE_FEE, Horizon, Networks, Operation, TransactionBuilder } =
      await import("@stellar/stellar-sdk");

    const horizon = new Horizon.Server(NETWORK.horizonUrl);
    const account = await horizon.loadAccount(address).catch(() => {
      throw new Error(
        "This account does not exist on testnet yet. Fund it with Friendbot first.",
      );
    });

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.changeTrust({ asset: new Asset(USDC.code, USDC.issuer) }),
      )
      .setTimeout(180)
      .build();

    const signed = await signXdr(tx.toXDR());
    const result = await horizon.submitTransaction(
      TransactionBuilder.fromXDR(signed, Networks.TESTNET),
    );

    await refresh();
    return result.hash;
  }, [address, signXdr, refresh]);

  // Ask the Freighter module whether the extension is present, so the button
  // can offer an install link instead of failing on click.
  useEffect(() => {
    let live = true;
    import("@creit.tech/stellar-wallets-kit/modules/freighter")
      .then(({ FreighterModule }) => new FreighterModule().isAvailable())
      .then((ok) => { if (live) setFreighterReady(ok); })
      .catch(() => { if (live) setFreighterReady(false); });
    return () => { live = false; };
  }, []);

  // Reconnect silently on reload if the wallet still recognises us.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    setAddress(saved);
    loadBalances(saved).then(setBalances).catch(() => setBalances(EMPTY_BALANCES));
  }, []);

  // Keep balances current while a mission is being funded or settled.
  useEffect(() => {
    if (!address) return;
    const id = setInterval(refresh, 12_000);
    return () => clearInterval(id);
  }, [address, refresh]);

  const value = useMemo<WalletApi>(
    () => ({
      address,
      isConnecting,
      freighterReady,
      isAuthenticating,
      authToken,
      balances,
      error,
      connect,
      disconnect,
      signXdr,
      signForContract,
      refresh,
      authenticate,
      addUsdcTrustline,
      fundWithFriendbot,
    }),
    [
      address,
      isConnecting,
      freighterReady,
      isAuthenticating,
      authToken,
      balances,
      error,
      connect,
      disconnect,
      signXdr,
      signForContract,
      refresh,
      authenticate,
      addUsdcTrustline,
      fundWithFriendbot,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletApi {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

/** Shorten a G… address for display without losing its ends. */
export function shortAddress(address: string, lead = 4, tail = 4): string {
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useWallet } from "@/lib/stellar/WalletContext";
import { explorerTx } from "@/lib/stellar/config";
import type { AnchorTransaction, DepositInstructions } from "@/lib/stellar/anchor";

type Stage =
  | { name: "amount" }
  | { name: "instructions"; deposit: DepositInstructions }
  | { name: "watching"; id: string; tx: AnchorTransaction | null }
  | { name: "done"; tx: AnchorTransaction };

/**
 * Lira in, USDC out.
 *
 * The bank leg is the part a testnet anchor cannot really perform, so the
 * sandbox exposes an endpoint that stands in for the incoming transfer. The
 * button for it is labelled as the simulation it is — on a production anchor
 * the customer's actual bank transfer does this and the button is not here.
 */
export function DepositPanel() {
  const { address, balances, authToken, authenticate, isAuthenticating, refresh } =
    useWallet();

  const [tryAmount, setTryAmount] = useState("500");
  const [rate, setRate] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ name: "amount" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Indicative rate, refreshed while the customer decides.
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/anchor/price?try=${encodeURIComponent(tryAmount || "500")}`);
        if (!res.ok) return;
        const { rate } = (await res.json()) as { rate: string };
        if (live) setRate(rate);
      } catch {
        /* the readout just shows a dash */
      }
    };
    void load();
    const id = setInterval(load, 30_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [tryAmount]);

  useEffect(() => () => void (pollRef.current && clearInterval(pollRef.current)), []);

  const usdcOut = rate && Number(tryAmount) > 0 ? Number(tryAmount) / Number(rate) : null;

  const watch = useCallback(
    (id: string, token: string) => {
      pollRef.current && clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/anchor/transaction?id=${encodeURIComponent(id)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const { transaction } = (await res.json()) as { transaction: AnchorTransaction };

          if (transaction.status === "completed") {
            pollRef.current && clearInterval(pollRef.current);
            setStage({ name: "done", tx: transaction });
            void refresh();
          } else {
            setStage({ name: "watching", id, tx: transaction });
          }
        } catch {
          /* keep polling; a blip is not a failure */
        }
      }, 2500);
    },
    [refresh],
  );

  async function start() {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const token = authToken ?? (await authenticate());
      const res = await fetch("/api/anchor/deposit", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ account: address, amount: tryAmount }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "The anchor refused the deposit");
      setStage({ name: "instructions", deposit: body as DepositInstructions });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the deposit");
    } finally {
      setBusy(false);
    }
  }

  async function simulateBank(id: string) {
    setBusy(true);
    setError(null);
    try {
      const token = authToken ?? (await authenticate());
      const res = await fetch("/api/anchor/simulate-bank", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, amount: Number(tryAmount).toFixed(2) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "The transfer did not register");
      setStage({ name: "watching", id, tx: null });
      watch(id, token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not register the transfer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="placard">
        <span>Cash in · lira to USDC</span>
        <span className="font-mono normal-case tracking-normal">SEP-6 deposit</span>
      </div>

      <div className="space-y-4 p-4">
        {stage.name === "amount" && (
          <>
            <div>
              <label htmlFor="try-in" className="readout-label mb-1.5 block">
                You send
              </label>
              <div className="flex items-stretch border border-bezel bg-panel-void focus-within:border-nav">
                <input
                  id="try-in"
                  type="number"
                  min="1"
                  value={tryAmount}
                  onChange={(e) => setTryAmount(e.target.value)}
                  className="w-full bg-transparent px-3 py-2.5 font-mono text-lg text-text-primary tabular-nums outline-none"
                />
                <span className="flex items-center border-l border-bezel px-3 font-condensed text-sm text-text-muted">
                  TRY
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-text-muted">
              <ArrowRight className="h-4 w-4 shrink-0" />
              <div className="h-px flex-1 bg-bezel" />
              <span className="font-mono text-[11px]">
                {rate ? `1 USDC = ${Number(rate).toFixed(4)} TRY` : "rate loading"}
              </span>
            </div>

            <div>
              <div className="readout-label mb-1.5">You receive</div>
              <div className="panel-inset flex items-baseline justify-between px-3 py-2.5">
                <span className="readout text-lg">
                  {usdcOut ? usdcOut.toFixed(4) : "—"}
                </span>
                <span className="font-condensed text-sm text-text-muted">USDC</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-text-muted">
                Rate from the anchor&apos;s SEP-38 quote, sourced from Reflector, with a
                0.5% spread. The firm rate is locked when the transfer lands.
              </p>
            </div>

            {address && !balances.exists && (
              <p className="border border-caution/40 bg-caution/8 p-2.5 text-[11px] leading-relaxed text-text-secondary">
                This key has no account on testnet yet, so there is nowhere for the
                anchor to pay. Open the wallet menu and create it with Friendbot
                — it takes one click and is free.
              </p>
            )}

            {address && balances.exists && !balances.hasUsdcTrustline && (
              <p className="border border-caution/40 bg-caution/8 p-2.5 text-[11px] leading-relaxed text-text-secondary">
                Your account has no USDC trustline. The anchor will hold the deposit until
                you add one — the wallet menu has the button.
              </p>
            )}

            <button
              onClick={start}
              disabled={!address || busy || isAuthenticating || Number(tryAmount) <= 0}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              {busy || isAuthenticating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isAuthenticating ? "Signing in to the anchor…" : "Starting…"}
                </>
              ) : !address ? (
                "Connect a wallet to continue"
              ) : (
                "Get bank details"
              )}
            </button>
            {!authToken && address && (
              <p className="text-center text-[11px] text-text-muted">
                You&apos;ll sign a challenge to log in. No password, no account — your key
                is the identity.
              </p>
            )}
          </>
        )}

        {stage.name === "instructions" && (
          <Instructions
            deposit={stage.deposit}
            amount={tryAmount}
            busy={busy}
            onSimulate={() => simulateBank(stage.deposit.id)}
          />
        )}

        {stage.name === "watching" && (
          <Watching tx={stage.tx} hasTrustline={balances.hasUsdcTrustline} />
        )}

        {stage.name === "done" && <Done tx={stage.tx} onAgain={() => setStage({ name: "amount" })} />}

        {error && (
          <p className="border border-warning/40 bg-warning/8 p-2.5 text-[11.5px] text-text-secondary">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="panel-inset px-3 py-2">
      <div className="readout-label mb-1">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <code className="break-all font-mono text-[12.5px] text-text-primary">{value}</code>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
          className="shrink-0 text-text-muted hover:text-data"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-engaged" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function Instructions({
  deposit,
  amount,
  busy,
  onSimulate,
}: {
  deposit: DepositInstructions;
  amount: string;
  busy: boolean;
  onSimulate: () => void;
}) {
  const fields = Object.entries(deposit.instructions ?? {});

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-text-secondary">
        Send{" "}
        <span className="font-mono text-text-primary">{Number(amount).toFixed(2)} TRY</span>{" "}
        to the account below. The reference is how the anchor matches your transfer — it
        must go in the description field.
      </p>

      {fields.length > 0 ? (
        <div className="space-y-2">
          {fields.map(([key, field]) => (
            <Field key={key} label={field.description || key} value={field.value} />
          ))}
        </div>
      ) : (
        deposit.how && (
          <pre className="panel-inset overflow-x-auto whitespace-pre-wrap p-3 font-mono text-[12px] text-text-secondary">
            {deposit.how}
          </pre>
        )
      )}

      <Field label="Order id" value={deposit.id} />

      <div className="border border-bezel-lit bg-panel-high p-3">
        <div className="readout-label mb-1.5 text-caution">Sandbox</div>
        <p className="mb-2.5 text-[11.5px] leading-relaxed text-text-secondary">
          This anchor has no real bank behind it, so the incoming transfer has to be
          triggered by hand. In production the bank does this and this button does not
          exist.
        </p>
        <button
          onClick={onSimulate}
          disabled={busy}
          className="btn-secondary flex w-full items-center justify-center gap-2 !py-2 text-xs"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Mark the lira as received
        </button>
      </div>
    </div>
  );
}

const STATUS_COPY: Record<string, string> = {
  incomplete: "Waiting on the transfer",
  pending_user_transfer_start: "Waiting for the lira to arrive",
  pending_anchor: "Anchor is converting and paying out",
  pending_trust: "Waiting for a USDC trustline on your account",
  pending_stellar: "Submitting the payment on Stellar",
  completed: "Settled",
};

function Watching({ tx, hasTrustline }: { tx: AnchorTransaction | null; hasTrustline: boolean }) {
  const status = tx?.status ?? "pending_anchor";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <Loader2 className="h-4 w-4 animate-spin text-data" />
        <span className="font-condensed text-sm text-text-primary">
          {STATUS_COPY[status] ?? status}
        </span>
      </div>

      <div className="panel-inset px-3 py-2">
        <div className="readout-label mb-1">Status</div>
        <code className="font-mono text-[12px] text-data">{status}</code>
      </div>

      {status === "pending_trust" && !hasTrustline && (
        <p className="border border-caution/40 bg-caution/8 p-2.5 text-[11.5px] leading-relaxed text-text-secondary">
          The lira arrived and the USDC is waiting. Add the USDC trustline from the wallet
          menu and the anchor will release it.
        </p>
      )}
    </div>
  );
}

function Done({ tx, onAgain }: { tx: AnchorTransaction; onAgain: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center bg-engaged/15">
          <Check className="h-3.5 w-3.5 text-engaged" />
        </span>
        <span className="font-condensed text-sm text-text-primary">
          {tx.amount_out} USDC is in your wallet
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="panel-inset px-3 py-2">
          <div className="readout-label mb-1">Lira in</div>
          <div className="readout text-sm">{tx.amount_in ?? "—"}</div>
        </div>
        <div className="panel-inset px-3 py-2">
          <div className="readout-label mb-1">Fee</div>
          <div className="readout text-sm">{tx.amount_fee ?? "—"}</div>
        </div>
      </div>

      {tx.stellar_transaction_id && (
        <a
          href={explorerTx(tx.stellar_transaction_id)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between border border-bezel px-3 py-2 transition-colors hover:border-data"
        >
          <span className="readout-label">Stellar transaction</span>
          <span className="flex items-center gap-1.5 font-mono text-[11.5px] text-data">
            {tx.stellar_transaction_id.slice(0, 10)}…
            <ExternalLink className="h-3 w-3" />
          </span>
        </a>
      )}

      <button onClick={onAgain} className="btn-secondary w-full !py-2 text-xs">
        Cash in again
      </button>
    </div>
  );
}

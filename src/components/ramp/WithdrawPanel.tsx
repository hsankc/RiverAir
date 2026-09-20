"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ExternalLink, Loader2 } from "lucide-react";
import { useWallet } from "@/lib/stellar/WalletContext";
import { explorerTx, NETWORK, USDC } from "@/lib/stellar/config";
import type { AnchorTransaction, WithdrawInstructions } from "@/lib/stellar/anchor";

type Stage =
  | { name: "amount" }
  | { name: "sending"; instructions: WithdrawInstructions }
  | { name: "watching"; id: string; hash: string; tx: AnchorTransaction | null }
  | { name: "done"; hash: string; tx: AnchorTransaction };

/**
 * USDC out, lira in.
 *
 * Unlike the deposit, every step here is real: the wallet signs an actual
 * Stellar payment to the anchor's treasury carrying the memo that identifies
 * the withdrawal. Only the bank payout at the far end is simulated.
 */
export function WithdrawPanel() {
  const { address, balances, authToken, authenticate, signXdr, refresh } = useWallet();

  const [usdcAmount, setUsdcAmount] = useState("5");
  const [rate, setRate] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ name: "amount" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/anchor/price?direction=sell&usdc=${encodeURIComponent(usdcAmount || "5")}`,
        );
        if (!res.ok) return;
        const { rate } = (await res.json()) as { rate: string };
        if (live) setRate(rate);
      } catch {
        /* readout falls back to a dash */
      }
    };
    void load();
    const id = setInterval(load, 30_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [usdcAmount]);

  useEffect(() => () => void (pollRef.current && clearInterval(pollRef.current)), []);

  const tryOut = rate && Number(usdcAmount) > 0 ? Number(usdcAmount) * Number(rate) : null;
  // Only a connected wallet has a balance to exceed; warning before that is noise.
  const overBalance = Boolean(address) && Number(usdcAmount) > Number(balances.usdc);

  const watch = useCallback(
    (id: string, hash: string, token: string) => {
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
            setStage({ name: "done", hash, tx: transaction });
            void refresh();
          } else {
            setStage({ name: "watching", id, hash, tx: transaction });
          }
        } catch {
          /* transient */
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
      const res = await fetch("/api/anchor/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: usdcAmount }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "The anchor refused the withdrawal");
      setStage({ name: "sending", instructions: body as WithdrawInstructions });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the withdrawal");
    } finally {
      setBusy(false);
    }
  }

  /** Build, sign and submit the USDC payment the anchor is waiting for. */
  async function send(instructions: WithdrawInstructions) {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const token = authToken ?? (await authenticate());
      const { Asset, BASE_FEE, Horizon, Memo, Networks, Operation, TransactionBuilder } =
        await import("@stellar/stellar-sdk");

      const horizon = new Horizon.Server(NETWORK.horizonUrl);
      const account = await horizon.loadAccount(address);

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: instructions.account_id,
            asset: new Asset(USDC.code, USDC.issuer),
            amount: Number(usdcAmount).toFixed(7),
          }),
        )
        // The memo is what ties this payment to the withdrawal. Without it the
        // anchor cannot tell whose lira this is.
        .addMemo(Memo.id(instructions.memo))
        .setTimeout(180)
        .build();

      const signed = await signXdr(tx.toXDR());
      const result = await horizon.submitTransaction(
        TransactionBuilder.fromXDR(signed, Networks.TESTNET),
      );

      setStage({ name: "watching", id: instructions.id, hash: result.hash, tx: null });
      watch(instructions.id, result.hash, token);
      void refresh();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(
        /op_underfunded|underfunded/i.test(raw)
          ? "Not enough USDC in the wallet for that amount."
          : /op_no_trust/i.test(raw)
            ? "The anchor's treasury cannot accept that asset."
            : raw,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="placard">
        <span>Cash out · USDC to lira</span>
        <span className="font-mono normal-case tracking-normal">SEP-6 withdraw</span>
      </div>

      <div className="space-y-4 p-4">
        {stage.name === "amount" && (
          <>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label htmlFor="usdc-out" className="readout-label">
                  You send
                </label>
                <button
                  onClick={() => setUsdcAmount(balances.usdc)}
                  className="font-mono text-[11px] text-data hover:underline"
                >
                  balance {Number(balances.usdc).toFixed(2)}
                </button>
              </div>
              <div
                className={`flex items-stretch border bg-panel-void ${
                  overBalance ? "border-warning" : "border-bezel focus-within:border-nav"
                }`}
              >
                <input
                  id="usdc-out"
                  type="number"
                  min="0"
                  step="0.01"
                  value={usdcAmount}
                  onChange={(e) => setUsdcAmount(e.target.value)}
                  className="w-full bg-transparent px-3 py-2.5 font-mono text-lg text-text-primary tabular-nums outline-none"
                />
                <span className="flex items-center border-l border-bezel px-3 font-condensed text-sm text-text-muted">
                  USDC
                </span>
              </div>
              {overBalance && (
                <p className="mt-1 text-[11px] text-warning">
                  More than the wallet holds.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 text-text-muted">
              <ArrowRight className="h-4 w-4 shrink-0" />
              <div className="h-px flex-1 bg-bezel" />
              <span className="font-mono text-[11px]">
                {rate ? `1 USDC = ${Number(rate).toFixed(4)} TRY` : "rate loading"}
              </span>
            </div>

            <div>
              <div className="readout-label mb-1.5">Lands in your account</div>
              <div className="panel-inset flex items-baseline justify-between px-3 py-2.5">
                <span className="readout text-lg">{tryOut ? tryOut.toFixed(2) : "—"}</span>
                <span className="font-condensed text-sm text-text-muted">TRY</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-text-muted">
                Paid out over FAST, simulated on this anchor. The Stellar leg is real.
              </p>
            </div>

            <button
              onClick={start}
              disabled={!address || busy || overBalance || Number(usdcAmount) <= 0}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {!address ? "Connect a wallet to continue" : "Start withdrawal"}
            </button>
          </>
        )}

        {stage.name === "sending" && (
          <div className="space-y-3">
            <p className="text-[12.5px] leading-relaxed text-text-secondary">
              The anchor is holding a slot for this withdrawal. Sending the USDC with the
              memo below is what claims it.
            </p>

            <div className="panel-inset px-3 py-2">
              <div className="readout-label mb-1">Treasury</div>
              <code className="break-all font-mono text-[11.5px] text-text-primary">
                {stage.instructions.account_id}
              </code>
            </div>
            <div className="panel-inset px-3 py-2">
              <div className="readout-label mb-1">Memo ({stage.instructions.memo_type})</div>
              <code className="font-mono text-[12.5px] text-nav">{stage.instructions.memo}</code>
            </div>

            <button
              onClick={() => send(stage.instructions)}
              disabled={busy}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send {Number(usdcAmount).toFixed(2)} USDC
            </button>
            <p className="text-center text-[11px] text-text-muted">
              Your wallet will ask you to approve a real testnet payment.
            </p>
          </div>
        )}

        {stage.name === "watching" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-data" />
              <span className="font-condensed text-sm text-text-primary">
                USDC sent — waiting for the anchor to pay out
              </span>
            </div>
            <div className="panel-inset px-3 py-2">
              <div className="readout-label mb-1">Status</div>
              <code className="font-mono text-[12px] text-data">
                {stage.tx?.status ?? "pending_user_transfer_start"}
              </code>
            </div>
            <TxLink hash={stage.hash} />
          </div>
        )}

        {stage.name === "done" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center bg-engaged/15">
                <Check className="h-3.5 w-3.5 text-engaged" />
              </span>
              <span className="font-condensed text-sm text-text-primary">
                {stage.tx.amount_out} TRY sent to your account
              </span>
            </div>
            <TxLink hash={stage.hash} />
            <button
              onClick={() => setStage({ name: "amount" })}
              className="btn-secondary w-full !py-2 text-xs"
            >
              Cash out again
            </button>
          </div>
        )}

        {error && (
          <p className="border border-warning/40 bg-warning/8 p-2.5 text-[11.5px] text-text-secondary">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function TxLink({ hash }: { hash: string }) {
  return (
    <a
      href={explorerTx(hash)}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between border border-bezel px-3 py-2 transition-colors hover:border-data"
    >
      <span className="readout-label">Stellar transaction</span>
      <span className="flex items-center gap-1.5 font-mono text-[11.5px] text-data">
        {hash.slice(0, 10)}…
        <ExternalLink className="h-3 w-3" />
      </span>
    </a>
  );
}

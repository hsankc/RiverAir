"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Loader2, Plus } from "lucide-react";
import {
  useWallet,
  shortAddress,
  FREIGHTER,
  FREIGHTER_INSTALL,
} from "@/lib/stellar/WalletContext";
import { explorerAccount } from "@/lib/stellar/config";

export default function WalletConnect() {
  const {
    address,
    isConnecting,
    freighterReady,
    balances,
    error,
    connect,
    disconnect,
    addUsdcTrustline,
    fundWithFriendbot,
    refresh,
  } = useWallet();

  const [open, setOpen] = useState(false);
  const [addingTrustline, setAddingTrustline] = useState(false);
  const [trustlineError, setTrustlineError] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleFund() {
    setFunding(true);
    setFundError(null);
    try {
      await fundWithFriendbot();
    } catch (e) {
      setFundError(e instanceof Error ? e.message : "Friendbot did not answer");
    } finally {
      setFunding(false);
    }
  }

  async function handleTrustline() {
    setAddingTrustline(true);
    setTrustlineError(null);
    try {
      await addUsdcTrustline();
    } catch (e) {
      setTrustlineError(e instanceof Error ? e.message : "Could not add the trustline");
    } finally {
      setAddingTrustline(false);
    }
  }

  if (!address) {
    // Freighter is the wallet almost everyone here uses, so it gets a direct
    // button and no chooser. The caret beside it opens the kit's picker for
    // anyone on something else. Both sit on one line so the header keeps its
    // height.
    return (
      <div className="relative flex items-stretch">
        {freighterReady ? (
          <button
            onClick={() => connect(FREIGHTER)}
            disabled={isConnecting}
            className="btn-primary whitespace-nowrap !px-3 text-[13px] sm:!px-4 sm:text-sm"
          >
            {isConnecting ? "Check your wallet…" : "Connect"}
            <span className="hidden sm:inline">&nbsp;Freighter</span>
          </button>
        ) : (
          <a
            href={FREIGHTER_INSTALL}
            target="_blank"
            rel="noreferrer"
            className="btn-primary whitespace-nowrap !px-3 text-[13px] sm:!px-4 sm:text-sm"
          >
            Install<span className="hidden sm:inline">&nbsp;Freighter</span>
          </a>
        )}

        <button
          onClick={() => connect()}
          disabled={isConnecting}
          title="Use another wallet"
          aria-label="Use another wallet"
          className="btn-secondary !border-l-0 !px-1.5"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>

        {error && (
          <span className="absolute right-0 top-full mt-1 max-w-60 text-right text-[11px] leading-snug text-warning">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2.5 border border-bezel bg-panel-raised px-3 py-2 text-sm transition-colors hover:border-bezel-lit"
      >
        <span className="status-dot status-active" />
        <span className="font-mono text-xs text-text-primary">{shortAddress(address)}</span>
        <span className="hidden font-mono text-xs text-data tabular-nums sm:inline">
          {Number(balances.usdc).toFixed(2)} USDC
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="panel animate-fade-in absolute right-0 z-50 mt-1.5 w-80">
          <div className="placard">
            <span>Account</span>
            <span className="font-mono normal-case tracking-normal">Testnet</span>
          </div>

          <div className="space-y-3 p-3.5">
            <div>
              <div className="readout-label mb-1">Address</div>
              <div className="flex items-center justify-between gap-2">
                <code className="break-all font-mono text-[11px] text-text-secondary">
                  {address}
                </code>
                <a
                  href={explorerAccount(address)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-text-muted hover:text-data"
                  aria-label="Open in explorer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="panel-inset p-2.5">
                <div className="readout-label mb-1">USDC</div>
                <div className="readout text-lg">{Number(balances.usdc).toFixed(2)}</div>
              </div>
              <div className="panel-inset p-2.5">
                <div className="readout-label mb-1">XLM spendable</div>
                <div className="readout text-lg">
                  {Number(balances.spendableXlm).toFixed(2)}
                </div>
              </div>
            </div>

            {!balances.exists && (
              <div className="border border-caution/40 bg-caution/8 p-2.5">
                <p className="mb-2 text-[11px] leading-relaxed text-text-secondary">
                  This key has never been used on testnet, so there is no account
                  behind it yet — nothing can hold a balance or a trustline until
                  one exists. Friendbot creates it and funds it with test XLM.
                </p>
                <button
                  onClick={handleFund}
                  disabled={funding}
                  className="btn-secondary flex w-full items-center justify-center gap-1.5 !py-1.5 text-xs"
                >
                  {funding ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Funding…
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3" /> Create and fund with Friendbot
                    </>
                  )}
                </button>
                {fundError && (
                  <p className="mt-1.5 text-[11px] text-warning">{fundError}</p>
                )}
              </div>
            )}

            {balances.exists && !balances.hasUsdcTrustline && (
              <div className="border border-caution/40 bg-caution/8 p-2.5">
                <p className="mb-2 text-[11px] leading-relaxed text-text-secondary">
                  This account cannot hold USDC yet. A trustline reserves 0.5 XLM and lets
                  the anchor pay deposits straight into your wallet.
                </p>
                <button
                  onClick={handleTrustline}
                  disabled={addingTrustline}
                  className="btn-secondary flex w-full items-center justify-center gap-1.5 !py-1.5 text-xs"
                >
                  {addingTrustline ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Adding…
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3" /> Add USDC trustline
                    </>
                  )}
                </button>
                {trustlineError && (
                  <p className="mt-1.5 text-[11px] text-warning">{trustlineError}</p>
                )}
              </div>
            )}

            {balances.hasUsdcTrustline && Number(balances.spendableXlm) < 0.5 && (
              <p className="border border-caution/40 bg-caution/8 p-2.5 text-[11px] leading-relaxed text-text-secondary">
                XLM is running low. Fees come out of this balance — top up at
                friendbot.stellar.org before funding a mission.
              </p>
            )}

            <div className="flex gap-2 border-t border-bezel pt-3">
              <button onClick={refresh} className="btn-secondary flex-1 !py-1.5 text-xs">
                Refresh
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  void disconnect();
                }}
                className="btn-secondary flex-1 !py-1.5 text-xs hover:!border-warning"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

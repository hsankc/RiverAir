"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Check, ExternalLink, Loader2, Lock } from "lucide-react";
import { useWallet } from "@/lib/stellar/WalletContext";
import { explorerTx, MISSION_ESCROW_ID } from "@/lib/stellar/config";
import {
  explainEscrowError,
  fundMission,
  rateToScaled,
  settlementUsdc,
  tryToScaled,
} from "@/lib/stellar/escrow";
import type { Mission, MissionType } from "@/lib/data";
import type { Point } from "./PointSelectMap";

// maplibre reaches for window as soon as it loads, so the picker only exists
// in the browser. The placeholder holds the panel height so nothing jumps.
const PointSelectMap = dynamic(() => import("./PointSelectMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[190px] w-full animate-pulse border border-bezel bg-panel-void" />
  ),
});

const TYPES: Array<{ id: MissionType; label: string; blurb: string }> = [
  { id: "cargo", label: "Cargo", blurb: "Move a package between two points" },
  { id: "agricultural", label: "Spraying", blurb: "Treat a field on a set pattern" },
  { id: "fire", label: "Fire response", blurb: "Survey and report an active fire" },
  { id: "traffic", label: "Traffic survey", blurb: "Watch a corridor and log flow" },
];

interface Props {
  onFunded: (mission: Mission, txHash: string) => void;
}

/**
 * Posting a mission is the moment money actually moves: the customer agrees a
 * lira price, the anchor locks a rate for it, and that many USDC goes into the
 * escrow contract where neither side can touch it until the drone has flown.
 */
export function FundMissionPanel({ onFunded }: Props) {
  const { address, balances, authToken, authenticate, signForContract, refresh } = useWallet();

  const [type, setType] = useState<MissionType>("cargo");
  const [title, setTitle] = useState("");
  const [from, setFrom] = useState<Point>({ lat: 40.99, lng: 29.027 });
  const [to, setTo] = useState<Point>({ lat: 41.043, lng: 29.008 });
  const [tryPrice, setTryPrice] = useState("250");
  const [hours, setHours] = useState("24");

  const [rate, setRate] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "quoting" | "signing">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ hash: string; usdc: string } | null>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/anchor/price?try=${encodeURIComponent(tryPrice || "250")}`);
        if (!res.ok) return;
        const { rate } = (await res.json()) as { rate: string };
        if (live) setRate(rate);
      } catch {
        /* the estimate just shows a dash */
      }
    };
    void load();
    const id = setInterval(load, 30_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [tryPrice]);

  const estimateUsdc =
    rate && Number(tryPrice) > 0
      ? Number(settlementUsdc(tryToScaled(tryPrice), rateToScaled(rate))) / 1e7
      : null;

  const shortOnUsdc = estimateUsdc !== null && estimateUsdc > Number(balances.usdc);
  const canSubmit =
    address && title.trim().length > 2 && Number(tryPrice) > 0 && !busy && !shortOnUsdc;

  async function submit() {
    if (!address) return;
    setError(null);

    try {
      // Lock the rate first. The quote id is what makes the USDC figure in the
      // escrow defensible against the lira figure the customer agreed to.
      setBusy("quoting");
      const token = authToken ?? (await authenticate());
      const quoteRes = await fetch("/api/anchor/quote", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tryAmount: Number(tryPrice).toFixed(2) }),
      });
      const quote = await quoteRes.json();
      if (!quoteRes.ok) throw new Error(quote.error ?? "Could not lock a rate");

      const quoteRate = rateToScaled(quote.rate as string);
      const tryScaled = tryToScaled(tryPrice);
      const amount = settlementUsdc(tryScaled, quoteRate);
      const id = Math.floor(Date.now() / 1000) % 2_000_000_000;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(hours) * 3600);

      setBusy("signing");
      const hash = await fundMission(
        { id, client: address, amount, tryAmount: tryScaled, quoteRate, deadline },
        signForContract,
      );

      onFunded(
        {
          id,
          type,
          title: title.trim(),
          description: `Escrowed ${Number(tryPrice).toFixed(2)} TRY`,
          fromLat: from.lat,
          fromLng: from.lng,
          toLat: to.lat,
          toLng: to.lng,
          payment: Number(amount) / 1e7,
          status: "open",
          droneId: null,
          createdAt: new Date(),
          priority: false,
          onChain: true,
        },
        hash,
      );

      setDone({ hash, usdc: (Number(amount) / 1e7).toFixed(4) });
      setTitle("");
      void refresh();
    } catch (e) {
      setError(explainEscrowError(e));
    } finally {
      setBusy(null);
    }
  }

  if (!MISSION_ESCROW_ID) {
    return (
      <section className="panel">
        <div className="placard">
          <span>Post a mission</span>
        </div>
        <p className="p-4 text-[12.5px] leading-relaxed text-text-secondary">
          The escrow contract is not deployed on this build, so missions cannot be funded.
          Run <code className="font-mono text-nav">scripts/deploy.sh</code> and set{" "}
          <code className="font-mono text-nav">NEXT_PUBLIC_MISSION_ESCROW_ID</code>.
        </p>
      </section>
    );
  }

  if (done) {
    return (
      <section className="panel">
        <div className="placard">
          <span>Mission funded</span>
          <span className="font-mono normal-case tracking-normal">Escrow</span>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center bg-engaged/15">
              <Check className="h-3.5 w-3.5 text-engaged" />
            </span>
            <span className="font-condensed text-sm text-text-primary">
              {done.usdc} USDC is locked until the drone has flown
            </span>
          </div>
          <a
            href={explorerTx(done.hash)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between border border-bezel px-3 py-2 transition-colors hover:border-data"
          >
            <span className="readout-label">Stellar transaction</span>
            <span className="flex items-center gap-1.5 font-mono text-[11.5px] text-data">
              {done.hash.slice(0, 10)}…
              <ExternalLink className="h-3 w-3" />
            </span>
          </a>
          <button onClick={() => setDone(null)} className="btn-secondary w-full !py-2 text-xs">
            Post another
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="placard">
        <span>Post a mission</span>
        <span className="font-mono normal-case tracking-normal">Escrow</span>
      </div>

      <div className="space-y-4 p-4">
        <fieldset>
          <legend className="readout-label mb-1.5">Work type</legend>
          <div className="grid grid-cols-2 gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                title={t.blurb}
                className={`border px-2.5 py-2 text-left transition-colors ${
                  type === t.id
                    ? "border-nav bg-nav/10 text-text-primary"
                    : "border-bezel text-text-secondary hover:border-bezel-lit"
                }`}
              >
                <span className="font-condensed text-[13px]">{t.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="m-title" className="readout-label mb-1.5 block">
            What needs doing
          </label>
          <input
            id="m-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Medical sample run, Kadıköy to Beşiktaş"
            className="w-full border border-bezel bg-panel-void px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-nav"
          />
        </div>

        <PointSelectMap
          from={from}
          to={to}
          onChange={(next) => {
            setFrom(next.from);
            setTo(next.to);
          }}
        />

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="m-price" className="readout-label mb-1.5 block">
              You pay
            </label>
            <div className="flex items-stretch border border-bezel bg-panel-void focus-within:border-nav">
              <input
                id="m-price"
                type="number"
                min="1"
                value={tryPrice}
                onChange={(e) => setTryPrice(e.target.value)}
                className="w-full bg-transparent px-3 py-2 font-mono text-text-primary tabular-nums outline-none"
              />
              <span className="flex items-center border-l border-bezel px-2.5 font-condensed text-xs text-text-muted">
                TRY
              </span>
            </div>
          </div>
          <div>
            <label htmlFor="m-hours" className="readout-label mb-1.5 block">
              Must fly within
            </label>
            <div className="flex items-stretch border border-bezel bg-panel-void focus-within:border-nav">
              <input
                id="m-hours"
                type="number"
                min="1"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full bg-transparent px-3 py-2 font-mono text-text-primary tabular-nums outline-none"
              />
              <span className="flex items-center border-l border-bezel px-2.5 font-condensed text-xs text-text-muted">
                HRS
              </span>
            </div>
          </div>
        </div>

        <div className="panel-inset p-3">
          <div className="flex items-baseline justify-between">
            <span className="readout-label">Locked in escrow</span>
            <span className="readout text-base">
              {estimateUsdc !== null ? estimateUsdc.toFixed(4) : "—"}{" "}
              <span className="text-[11px] text-text-muted">USDC</span>
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
            {rate
              ? `Converted at ${Number(rate).toFixed(4)} TRY per USDC. The rate is locked again, firmly, at the moment you sign.`
              : "Waiting on a rate from the anchor."}
          </p>
        </div>

        {shortOnUsdc && (
          <p className="border border-caution/40 bg-caution/8 p-2.5 text-[11.5px] leading-relaxed text-text-secondary">
            This wallet holds {Number(balances.usdc).toFixed(2)} USDC.{" "}
            <Link href="/ramp" className="text-nav underline">
              Cash in some lira
            </Link>{" "}
            to cover it.
          </p>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="btn-primary flex w-full items-center justify-center gap-2"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {busy === "quoting" ? "Locking the rate…" : "Waiting for your signature…"}
            </>
          ) : !address ? (
            "Connect a wallet to post"
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Fund the escrow
            </>
          )}
        </button>

        {error && (
          <p className="border border-warning/40 bg-warning/8 p-2.5 text-[11.5px] leading-relaxed text-text-secondary">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

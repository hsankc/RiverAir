"use client";

import { useEffect, useState } from "react";
import { MISSION_ESCROW_ID, REFLECTOR } from "@/lib/stellar/config";
import { readOracleHealth } from "@/lib/stellar/escrow";

type Health =
  | { kind: "loading" }
  | { kind: "ok"; price: number; ageSeconds: number }
  | { kind: "down"; reason: string }
  | { kind: "undeployed" };

/**
 * Live state of the two things a settlement depends on: the price feed the
 * escrow reads before releasing funds, and the lira rate from the anchor.
 *
 * This is not decoration. When the feed goes stale the escrow refuses to pay
 * out, so an operator wondering why a mission will not settle can see the
 * reason here before signing anything.
 */
export function SystemStrip() {
  const [oracle, setOracle] = useState<Health>({ kind: "loading" });
  const [rate, setRate] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    async function poll() {
      if (!MISSION_ESCROW_ID) {
        if (live) setOracle({ kind: "undeployed" });
      } else {
        try {
          const reading = await readOracleHealth();
          if (!live) return;
          setOracle({
            kind: "ok",
            price: Number(reading.price) / 10 ** REFLECTOR.decimals,
            ageSeconds: Math.max(
              0,
              Math.floor(Date.now() / 1000) - Number(reading.timestamp),
            ),
          });
        } catch (e) {
          if (!live) return;
          const raw = e instanceof Error ? e.message : String(e);
          setOracle({
            kind: "down",
            reason: /#10|Stale/.test(raw)
              ? "stale"
              : /#11|Depeg/.test(raw)
                ? "depegged"
                : "unreachable",
          });
        }
      }

      try {
        const res = await fetch("/api/anchor/price?try=1000");
        if (res.ok && live) {
          const { rate } = (await res.json()) as { rate: string };
          setRate(rate);
        }
      } catch {
        if (live) setRate(null);
      }
    }

    void poll();
    const id = setInterval(poll, 30_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="hidden items-center gap-4 border-r border-bezel pr-4 md:flex">
      <Readout label="TRY / USDC" value={rate ? Number(rate).toFixed(2) : "—"} tone="data" />
      <OracleReadout health={oracle} />
    </div>
  );
}

function Readout({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: string;
  tone: "data" | "engaged" | "caution" | "warning" | "muted";
  title?: string;
}) {
  const colour = {
    data: "text-data",
    engaged: "text-engaged",
    caution: "text-caution",
    warning: "text-warning",
    muted: "text-text-muted",
  }[tone];

  return (
    <div title={title}>
      <div className="readout-label leading-none">{label}</div>
      <div className={`readout mt-1 text-[13px] ${colour}`}>{value}</div>
    </div>
  );
}

function OracleReadout({ health }: { health: Health }) {
  if (health.kind === "loading") {
    return <Readout label="Price feed" value="…" tone="muted" />;
  }
  if (health.kind === "undeployed") {
    return (
      <Readout
        label="Price feed"
        value="no escrow"
        tone="muted"
        title="Deploy the escrow and set NEXT_PUBLIC_MISSION_ESCROW_ID to read the feed."
      />
    );
  }
  if (health.kind === "down") {
    return (
      <Readout
        label="Price feed"
        value={health.reason}
        tone="warning"
        title="The escrow will not settle a mission while the feed is in this state. Funds stay locked."
      />
    );
  }

  const stale = health.ageSeconds > REFLECTOR.resolutionSeconds * 2;
  return (
    <Readout
      label="Price feed"
      value={`${health.price.toFixed(4)} · ${health.ageSeconds}s`}
      tone={stale ? "caution" : "engaged"}
      title={`Reflector USDC/USD, ${health.ageSeconds}s old. The escrow rejects anything older than 900s.`}
    />
  );
}

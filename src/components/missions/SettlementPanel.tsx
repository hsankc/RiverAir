"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { useWallet } from "@/lib/stellar/WalletContext";
import { MISSION_ESCROW_ID, NETWORK, REFLECTOR } from "@/lib/stellar/config";
import {
  completeMission,
  explainEscrowError,
  flightRecordHash,
  readConfig,
  readOracleHealth,
  type EscrowConfig,
} from "@/lib/stellar/escrow";
import type { Mission } from "@/lib/data";

type Verdict =
  | { kind: "loading" }
  | { kind: "undeployed" }
  | { kind: "pass"; price: number; ageSeconds: number; driftBps: number }
  | { kind: "refuse"; reason: string; detail: string };

interface Props {
  /** Missions funded into the escrow in this session, with their live status. */
  missions: Mission[];
  onSettled: (missionId: number, txHash: string) => void;
}

/**
 * The settlement gate, made visible.
 *
 * `complete()` does not simply pay an operator. It reads Reflector first and
 * refuses to release anything if the price is older than the contract's
 * `max_price_age` or USDC has drifted further off the dollar than
 * `depeg_bps` allows. That refusal is the most important behaviour in the
 * contract and it is invisible on a screen that only ever shows a happy path,
 * so this panel runs the same check read-only and says what would happen.
 *
 * The thresholds are read from the deployed contract, not restated here, so
 * the panel cannot drift out of agreement with the code that enforces them.
 */
export function SettlementPanel({ missions, onSettled }: Props) {
  const { address, signForContract } = useWallet();
  const [config, setConfig] = useState<EscrowConfig | null>(null);
  const [verdict, setVerdict] = useState<Verdict>({ kind: "loading" });
  const [settling, setSettling] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!MISSION_ESCROW_ID) {
      setVerdict({ kind: "undeployed" });
      return;
    }

    let cfg = config;
    if (!cfg) {
      try {
        cfg = await readConfig();
        setConfig(cfg);
      } catch {
        // Fall through: the health read below reports the real problem.
      }
    }

    try {
      const reading = await readOracleHealth();
      const one = 10 ** REFLECTOR.decimals;
      const price = Number(reading.price) / one;
      const ageSeconds = Math.max(
        0,
        Math.floor(Date.now() / 1000) - Number(reading.timestamp),
      );
      // Same arithmetic the contract runs, in basis points off the peg.
      const driftBps = Math.round(Math.abs(price - 1) * 10_000);
      setVerdict({ kind: "pass", price, ageSeconds, driftBps });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const reason = /#10|Stale/.test(raw)
        ? "Price feed stale"
        : /#11|Depeg/.test(raw)
          ? "USDC off peg"
          : /#9|NoPrice/.test(raw)
            ? "No price"
            : "Feed unreachable";
      setVerdict({ kind: "refuse", reason, detail: explainEscrowError(e) });
    }
  }, [config]);

  useEffect(() => {
    void check();
    const id = setInterval(() => void check(), 30_000);
    return () => clearInterval(id);
  }, [check]);

  /** Settle a flown mission against the record of what was actually flown. */
  async function settle(mission: Mission) {
    if (!address) {
      setNotice("Connect a wallet to settle.");
      return;
    }

    setSettling(mission.id);
    setNotice(null);
    try {
      const proof = await flightRecordHash({
        missionId: mission.id,
        drone: String(mission.droneId ?? "unassigned"),
        from: [mission.fromLat, mission.fromLng],
        to: [mission.toLat, mission.toLng],
        flownAt: Math.floor(Date.now() / 1000),
      });

      const txHash = await completeMission(
        { id: mission.id, operator: address, proof },
        signForContract,
      );
      onSettled(mission.id, txHash);
      setNotice(`Settled. ${mission.payment.toFixed(4)} USDC released to your account.`);
    } catch (e) {
      // A refusal here is the contract working, not the app failing.
      setNotice(explainEscrowError(e));
      void check();
    } finally {
      setSettling(null);
    }
  }

  const claimed = missions.filter(
    (m) => m.status === "accepted" || m.status === "in-progress",
  );
  const maxAge = config ? Number(config.max_price_age) : null;
  const maxDriftBps = config ? config.depeg_bps : null;

  return (
    <section className="panel p-3.5">
      <header className="mb-3">
        <h2 className="font-condensed text-[15px] font-semibold text-text-primary">
          Settlement gate
        </h2>
        <p className="mt-0.5 text-[11.5px] text-text-muted">
          What the escrow would do right now if an operator asked to be paid.
        </p>
      </header>

      <VerdictBlock verdict={verdict} maxAge={maxAge} maxDriftBps={maxDriftBps} />

      {config && (
        <dl className="mt-3 space-y-1.5 border-t border-bezel pt-2.5 text-[11px]">
          <Row label="Feed" value={`Reflector · ${config.oracle_asset}/USD`} />
          <Row label="Rejects a price older than" value={`${Number(config.max_price_age)} s`} />
          <Row label="Rejects drift beyond" value={`${config.depeg_bps} bps`} />
        </dl>
      )}

      <div className="mt-3 border-t border-bezel pt-2.5">
        <h3 className="readout-label mb-2">Claimed by you</h3>

        {claimed.length === 0 ? (
          <p className="text-[11.5px] text-text-muted">
            Nothing to settle. Fund a mission, claim it, then settle it here — the
            contract checks the feed before it releases anything.
          </p>
        ) : (
          <ul className="space-y-2">
            {claimed.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 border border-bezel bg-panel-void px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-condensed text-[12.5px] text-text-primary">
                    {m.title}
                  </p>
                  <p className="readout mt-0.5 text-[11px] text-text-muted">
                    {m.payment.toFixed(4)} USDC · #{m.id}
                  </p>
                </div>
                <button
                  onClick={() => settle(m)}
                  disabled={settling === m.id}
                  className="btn-secondary shrink-0 !py-1.5 text-xs"
                >
                  {settling === m.id ? "Settling…" : "Settle"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {notice && (
        <p className="mt-3 border border-bezel-lit bg-panel-high p-2.5 text-[11.5px] text-text-secondary">
          {notice}
        </p>
      )}

      {MISSION_ESCROW_ID && (
        <a
          href={`${NETWORK.explorerUrl}/contract/${MISSION_ESCROW_ID}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block truncate font-mono text-[10.5px] text-text-muted underline decoration-bezel-lit underline-offset-2 hover:text-data"
        >
          {MISSION_ESCROW_ID}
        </a>
      )}
    </section>
  );
}

function VerdictBlock({
  verdict,
  maxAge,
  maxDriftBps,
}: {
  verdict: Verdict;
  maxAge: number | null;
  maxDriftBps: number | null;
}) {
  if (verdict.kind === "loading") {
    return (
      <div className="flex items-center gap-2 border border-bezel bg-panel-void px-3 py-2.5 text-[12px] text-text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Reading the feed through the contract…
      </div>
    );
  }

  if (verdict.kind === "undeployed") {
    return (
      <div className="border border-bezel bg-panel-void px-3 py-2.5 text-[12px] text-text-muted">
        No escrow deployed on this build, so there is nothing to gate.
      </div>
    );
  }

  if (verdict.kind === "refuse") {
    return (
      <div className="border border-warning/40 bg-warning/5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
          <span className="font-condensed text-[13px] font-semibold text-warning">
            Would refuse · {verdict.reason}
          </span>
        </div>
        <p className="mt-1.5 text-[11.5px] text-text-secondary">{verdict.detail}</p>
        <p className="mt-1.5 text-[11px] text-text-muted">
          The money stays in escrow. Nobody is paid at a rate nobody can vouch for.
        </p>
      </div>
    );
  }

  const ageOk = maxAge === null || verdict.ageSeconds <= maxAge;
  const driftOk = maxDriftBps === null || verdict.driftBps <= maxDriftBps;

  return (
    <div className="border border-engaged/40 bg-engaged/5 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 text-engaged" />
        <span className="font-condensed text-[13px] font-semibold text-engaged">
          Would settle
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <Metric label="USDC / USD" value={verdict.price.toFixed(4)} ok />
        <Metric
          label="Price age"
          value={`${verdict.ageSeconds}s`}
          ok={ageOk}
          limit={maxAge === null ? undefined : `${maxAge}s`}
        />
        <Metric
          label="Off peg"
          value={`${verdict.driftBps} bps`}
          ok={driftOk}
          limit={maxDriftBps === null ? undefined : `${maxDriftBps} bps`}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  ok,
  limit,
}: {
  label: string;
  value: string;
  ok: boolean;
  limit?: string;
}) {
  return (
    <div>
      <div className="readout-label leading-none">{label}</div>
      <div className={`readout mt-1 text-[12px] ${ok ? "text-engaged" : "text-caution"}`}>
        {value}
      </div>
      {limit && <div className="mt-0.5 text-[10px] text-text-muted">max {limit}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="readout text-right text-[11px] text-text-secondary">{value}</dd>
    </div>
  );
}

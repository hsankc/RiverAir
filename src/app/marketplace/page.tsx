"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FundMissionPanel } from "@/components/missions/FundMissionPanel";
import { MissionCard } from "@/components/missions/MissionCard";
import { SettlementPanel } from "@/components/missions/SettlementPanel";
import { useDroneFleet } from "@/lib/DroneFleetContext";
import { useWallet } from "@/lib/stellar/WalletContext";
import { assignMission, explainEscrowError } from "@/lib/stellar/escrow";
import { MISSION_ESCROW_ID } from "@/lib/stellar/config";
import type { Mission, MissionType } from "@/lib/data";

const FILTERS: Array<{ id: MissionType | "all"; label: string }> = [
  { id: "all", label: "Everything" },
  { id: "cargo", label: "Cargo" },
  { id: "agricultural", label: "Spraying" },
  { id: "fire", label: "Fire" },
  { id: "traffic", label: "Traffic" },
];

export default function MarketplacePage() {
  const { liveMissions, drones, postMission } = useDroneFleet();
  const { address, signForContract } = useWallet();

  // Missions funded in this session sit alongside the simulated board until
  // the operator picks them up.
  const [funded, setFunded] = useState<Mission[]>([]);
  const [filter, setFilter] = useState<MissionType | "all">("all");
  const [claiming, setClaiming] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const missions = useMemo(() => {
    // A funded mission is also on the fleet board, where the simulation moves
    // it through claimed and flown. That copy is the live one, so prefer it and
    // keep the funded entry only until the board has caught up.
    const onBoard = new Set(liveMissions.map((m) => m.id));
    const all = [...funded.filter((m) => !onBoard.has(m.id)), ...liveMissions];
    return filter === "all" ? all : all.filter((m) => m.type === filter);
  }, [funded, liveMissions, filter]);

  /** Ids that exist in the contract, so the card knows what it can offer. */
  const onChain = useMemo(() => new Set(funded.map((m) => m.id)), [funded]);

  const openCount = missions.filter((m) => m.status === "open").length;
  const escrowed = missions
    .filter((m) => m.status !== "completed" && m.status !== "cancelled")
    .reduce((sum, m) => sum + m.payment, 0);

  const droneName = (id: number | null) =>
    id == null ? undefined : drones.find((d) => d.id === id)?.name;

  /** Operators claim work themselves; the contract records who signed. */
  async function take(mission: Mission) {
    if (!address) {
      setNotice("Connect a wallet to claim a mission.");
      return;
    }
    if (!MISSION_ESCROW_ID) {
      setNotice("The escrow is not deployed on this build, so claims are off.");
      return;
    }

    setClaiming(mission.id);
    setNotice(null);
    try {
      await assignMission({ id: mission.id, operator: address }, signForContract);
      setFunded((prev) =>
        prev.map((m) => (m.id === mission.id ? { ...m, status: "accepted" } : m)),
      );
      setNotice(`Claimed "${mission.title}". Fly it before the deadline to get paid.`);
    } catch (e) {
      setNotice(explainEscrowError(e));
    } finally {
      setClaiming(null);
    }
  }

  return (
    <AppShell
      title="Missions"
      subtitle="Work posted by customers, priced in lira and held in escrow until it is flown"
    >
      {/* minmax(0,…) on both tracks: an auto track sizes to its widest child's
          min-content, and the form panel on the right would otherwise push the
          whole column past the viewport on a phone. */}
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="order-2 min-w-0 space-y-3 lg:order-none">
          <div className="panel flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`border px-2.5 py-1 font-condensed text-[12.5px] transition-colors ${
                    filter === f.id
                      ? "border-nav bg-nav/10 text-text-primary"
                      : "border-bezel text-text-secondary hover:border-bezel-lit"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-5">
              <div>
                <div className="readout-label">Open</div>
                <div className="readout mt-0.5 text-sm">{openCount}</div>
              </div>
              <div>
                <div className="readout-label">Held in escrow</div>
                <div className="readout mt-0.5 text-sm">{escrowed.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {notice && (
            <p className="border border-bezel-lit bg-panel-high p-2.5 text-[12px] text-text-secondary">
              {notice}
            </p>
          )}

          {missions.length === 0 ? (
            <div className="panel p-8 text-center">
              <p className="text-[13px] text-text-secondary">
                Nothing posted under that filter yet.
              </p>
              <p className="mt-1 text-[12px] text-text-muted">
                Post the first one from the panel on the right.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {missions.map((m) => (
                <MissionCard
                  key={`${m.id}-${m.status}`}
                  mission={m}
                  droneName={droneName(m.droneId)}
                  onTake={take}
                  busy={claiming === m.id}
                  onChain={onChain.has(m.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* On a phone the board is a dozen cards long, so the two panels that
            actually move money lead instead of trailing them. */}
        <div className="order-1 min-w-0 space-y-4 lg:order-none">
          <FundMissionPanel
            onFunded={(mission) => {
              setFunded((prev) => [mission, ...prev]);
              // Hand it straight to the fleet. Nobody dispatches the aircraft —
              // the first one rated for this work and near enough to reach it
              // takes the job off the board on its own.
              postMission(mission);
            }}
          />
          <SettlementPanel
            missions={funded}
            onSettled={(id) =>
              setFunded((prev) =>
                prev.map((m) => (m.id === id ? { ...m, status: "completed" } : m)),
              )
            }
          />
        </div>
      </div>
    </AppShell>
  );
}

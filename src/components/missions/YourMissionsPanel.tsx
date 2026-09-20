"use client";

import { ExternalLink, Plane } from "lucide-react";
import { explorerTx } from "@/lib/stellar/config";
import type { DroneAgent, FlightPhase, Mission } from "@/lib/data";

interface Props {
  /** What this wallet funded, newest first. Carries the contract identity. */
  funded: Mission[];
  /** The live board, which carries the status the fleet is actually flying. */
  live: Mission[];
  drones: DroneAgent[];
  /** Funding transaction per mission id. */
  txs: Record<number, string>;
}

const PHASE: Record<FlightPhase, string> = {
  grounded: "On the pad",
  takeoff: "Climbing out",
  cruise: "En route",
  onsite: "Working the site",
  return: "Heading home",
  landing: "Landing",
};

/**
 * The customer's own work, pulled out of the board.
 *
 * The board shows every mission in the city and a funded one is a single card
 * among a dozen, which is no use to the person who just paid for it. This
 * follows only what this wallet posted, and once an aircraft takes the job it
 * reads that aircraft's telemetry back — so the money, the drone and the flight
 * are one thing on screen rather than three places to look.
 */
export function YourMissionsPanel({ funded, live, drones, txs }: Props) {
  if (funded.length === 0) return null;

  return (
    <section className="panel">
      <div className="placard">
        <span>Your missions</span>
        <span className="font-mono normal-case tracking-normal">
          {funded.length} posted
        </span>
      </div>

      <div className="space-y-2 p-3.5">
        {funded.map((posted) => {
          // The board's copy is the live one: the simulation moves it through
          // claimed and flown, while `posted` only remembers what was funded.
          const m = live.find((l) => l.id === posted.id) ?? posted;
          const drone = m.droneId == null ? null : drones.find((d) => d.id === m.droneId);
          const tx = txs[posted.id];
          const done = m.status === "completed";

          return (
            <div key={posted.id} className="border border-bezel bg-panel-void p-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] font-medium text-text-primary">
                  {m.title}
                </span>
                <span className="readout shrink-0 text-[13px]">
                  {m.payment.toFixed(4)}{" "}
                  <span className="text-[10px] text-text-muted">USDC</span>
                </span>
              </div>

              {!drone && !done && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-text-muted">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-caution" />
                  Open — waiting for an aircraft to take it
                </p>
              )}

              {done && (
                <p className="mt-1.5 text-[11.5px] text-engaged">
                  Flown{drone ? ` by ${drone.name}` : ""} — ready to settle
                </p>
              )}

              {drone && !done && (
                <>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-data">
                    <Plane className="h-3 w-3" />
                    <span className="font-medium">{drone.name}</span>
                    <span className="text-text-muted">
                      {PHASE[drone.phase ?? "grounded"]}
                    </span>
                  </p>

                  <div className="mt-2 grid grid-cols-3 gap-2 border-t border-bezel pt-2">
                    <Cell label="Battery" value={`${drone.battery.toFixed(0)}%`} />
                    <Cell label="Altitude" value={`${Math.round(drone.altitude)} m`} />
                    <Cell label="Speed" value={`${Math.round(drone.speed)} km/h`} />
                  </div>
                </>
              )}

              {tx && (
                <a
                  href={explorerTx(tx)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 flex items-center gap-1 font-mono text-[10.5px] text-text-muted transition-colors hover:text-nav"
                >
                  {tx.slice(0, 12)}… <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="readout-label">{label}</p>
      <p className="readout mt-0.5 text-[13px]">{value}</p>
    </div>
  );
}

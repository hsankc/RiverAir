"use client";

import { Clock, MapPin } from "lucide-react";
import type { Mission } from "@/lib/data";

const TYPE_TONE: Record<string, string> = {
  cargo: "text-data border-data/40",
  agricultural: "text-engaged border-engaged/40",
  fire: "text-warning border-warning/40",
  traffic: "text-caution border-caution/40",
};

const STATUS_TONE: Record<string, string> = {
  open: "text-nav",
  accepted: "text-caution",
  "in-progress": "text-caution",
  completed: "text-engaged",
  cancelled: "text-text-muted",
};

const STATUS_COPY: Record<string, string> = {
  open: "Open for bids",
  accepted: "Claimed",
  "in-progress": "Flying",
  completed: "Settled",
  cancelled: "Cancelled",
};

interface Props {
  mission: Mission;
  droneName?: string;
  onTake?: (mission: Mission) => void;
  busy?: boolean;
  /**
   * Whether this mission was actually funded into the escrow. The board also
   * carries missions the simulation invented, which have no contract state
   * behind them — offering "Take this" on one of those only produces a
   * MissionNotFound from the contract.
   */
  onChain?: boolean;
}

export function MissionCard({ mission, droneName, onTake, busy, onChain }: Props) {
  const distance = haversineKm(
    mission.fromLat,
    mission.fromLng,
    mission.toLat,
    mission.toLng,
  );

  return (
    <article className="panel p-3.5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-condensed text-[15px] font-semibold text-text-primary">
            {mission.title}
          </h3>
          <p className="mt-0.5 truncate text-[11.5px] text-text-muted">
            {mission.description}
          </p>
        </div>
        <span
          className={`shrink-0 border px-1.5 py-0.5 font-condensed text-[10.5px] tracking-wide ${
            TYPE_TONE[mission.type] ?? "text-text-muted border-bezel"
          }`}
        >
          {mission.type}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-text-muted">
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3" />
          <span className="font-mono">{distance.toFixed(1)} km</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          <span className="font-mono">
            {new Date(mission.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </span>
        <span className={STATUS_TONE[mission.status] ?? "text-text-muted"}>
          {STATUS_COPY[mission.status] ?? mission.status}
          {droneName && ` · ${droneName}`}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3 border-t border-bezel pt-2.5">
        <div>
          <div className="readout-label">In escrow</div>
          <div className="readout mt-0.5 text-base">
            {mission.payment.toFixed(4)}{" "}
            <span className="text-[11px] text-text-muted">USDC</span>
          </div>
        </div>

        {mission.status === "open" &&
          (onChain && onTake ? (
            <button
              onClick={() => onTake(mission)}
              disabled={busy}
              className="btn-secondary !py-1.5 text-xs"
            >
              {busy ? "Claiming…" : "Take this"}
            </button>
          ) : (
            <span
              className="shrink-0 text-[10.5px] text-text-muted"
              title="This one came off the simulated board. Fund a mission to claim one on chain."
            >
              simulated
            </span>
          ))}
      </div>
    </article>
  );
}

/** Great-circle distance, good enough for a route estimate. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

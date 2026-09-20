"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { Mission } from "@/lib/data";

const STATUS_COPY: Record<string, string> = {
  open: "Open",
  accepted: "Claimed",
  "in-progress": "Flying",
  completed: "Settled",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<string, string> = {
  open: "text-nav border-nav/40",
  accepted: "text-caution border-caution/40",
  "in-progress": "text-caution border-caution/40",
  completed: "text-engaged border-engaged/40",
  cancelled: "text-text-muted border-bezel",
};

/**
 * Missions currently in play. Takes them from the shared fleet state so the
 * board agrees with the map beside it.
 */
export function MissionFeed({ missions }: { missions: Mission[] }) {
  const live = missions
    .filter((m) => m.status !== "completed" && m.status !== "cancelled")
    .slice(0, 5);

  return (
    <section className="panel">
      <div className="placard">
        <span>Missions in play</span>
        <Link href="/marketplace" className="normal-case tracking-normal text-data hover:underline">
          All of them
        </Link>
      </div>

      {live.length === 0 ? (
        <p className="p-4 text-[12.5px] text-text-muted">
          Nothing in the air. New work appears here as it is posted.
        </p>
      ) : (
        <ul className="divide-y divide-bezel">
          {live.map((m) => (
            <li key={m.id} className="p-3.5">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <h4 className="min-w-0 truncate font-condensed text-[14px] font-semibold text-text-primary">
                  {m.title}
                </h4>
                <span className="readout shrink-0 text-[13px]">
                  {m.payment.toFixed(2)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`border px-1.5 py-0.5 font-condensed text-[10.5px] tracking-wide ${
                    STATUS_TONE[m.status] ?? "text-text-muted border-bezel"
                  }`}
                >
                  {STATUS_COPY[m.status] ?? m.status}
                </span>
                <span className="font-mono text-[10.5px] text-text-muted">{m.type}</span>
                {m.priority && (
                  <span className="flex items-center gap-1 text-[10.5px] text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    Priority
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";

import type { DroneAgent, Mission } from "@/lib/data";

/**
 * Fleet state at a glance. Every figure is derived from the live simulation —
 * an earlier version counted a frozen seed array, so the "completed" tile never
 * moved and was counting in-progress missions besides.
 */
export function NetworkStats({
  drones,
  missions,
}: {
  drones: DroneAgent[];
  missions: Mission[];
}) {
  const flying = drones.filter(
    (d) => d.status === "in-flight" || d.status === "mission",
  ).length;
  const charging = drones.filter((d) => d.status === "charging").length;
  const avgBattery = drones.length
    ? Math.round(drones.reduce((a, d) => a + d.battery, 0) / drones.length)
    : 0;
  const completed = missions.filter((m) => m.status === "completed").length;

  const tiles = [
    { label: "In the air", value: String(flying), tone: "text-data" },
    { label: "On charge", value: String(charging), tone: "text-caution" },
    { label: "Mean battery", value: `${avgBattery}%`, tone: avgBattery < 35 ? "text-warning" : "text-engaged" },
    { label: "Missions flown", value: String(completed), tone: "text-text-primary" },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="stat-card">
          <div className="readout-label">{t.label}</div>
          <div className={`readout mt-1.5 text-2xl ${t.tone}`}>{t.value}</div>
        </div>
      ))}
    </div>
  );
}

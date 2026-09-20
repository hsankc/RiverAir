"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Crosshair, Radio } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DroneAgent, DroneType, initialPods, initialObstacles } from "@/lib/data";
import { useDroneFleet } from "@/lib/DroneFleetContext";
import {
  AgentTerminal,
  DronePanel,
  FleetList,
  MissionFeed,
  NetworkStats,
  WeatherWidget,
} from "@/components/dashboard";

const SkyMap = dynamic(() => import("@/components/SkyMap"), { ssr: false });

export default function DashboardPage() {
  const { drones, liveMissions, logs } = useDroneFleet();
  const [selectedDroneId, setSelectedDroneId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<DroneType | "all">("all");
  const [showRadar, setShowRadar] = useState(false);

  const selectedDrone = selectedDroneId
    ? (drones.find((d) => d.id === selectedDroneId) ?? null)
    : null;

  const handleDroneSelect = useCallback((drone: DroneAgent) => {
    setSelectedDroneId(drone.id);
  }, []);

  // The dispatcher names a drone; the map follows.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.droneId) setSelectedDroneId(detail.droneId);
    };
    window.addEventListener("select-drone", handler);
    return () => window.removeEventListener("select-drone", handler);
  }, []);

  return (
    <AppShell
      title="Operations"
      subtitle="Live fleet over İstanbul"
      rail={
        <div className="space-y-px border-t border-bezel">
          <WeatherWidget />
          <FleetList
            drones={drones}
            selectedDroneId={selectedDroneId}
            onSelect={handleDroneSelect}
          />
        </div>
      }
    >
      <NetworkStats drones={drones} missions={liveMissions} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="panel flex min-h-[520px] flex-col overflow-hidden lg:col-span-2">
          <div className="placard">
            <span>Live operation map</span>
            <div className="flex items-center gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as DroneType | "all")}
                aria-label="Filter the fleet by type"
                className="border border-bezel bg-panel-void px-2 py-1 font-condensed text-[11px] normal-case tracking-normal text-text-secondary outline-none focus:border-nav"
              >
                <option value="all">All aircraft</option>
                <option value="cargo">Cargo</option>
                <option value="agricultural">Agricultural</option>
                <option value="surveillance">Surveillance</option>
                <option value="emergency">Emergency</option>
              </select>

              <button
                onClick={() => setShowRadar((v) => !v)}
                aria-pressed={showRadar}
                className={`flex items-center gap-1.5 border px-2 py-1 font-condensed text-[11px] normal-case tracking-normal transition-colors ${
                  showRadar
                    ? "border-nav bg-nav/10 text-nav"
                    : "border-bezel text-text-muted hover:border-bezel-lit"
                }`}
              >
                <Radio className="h-3 w-3" />
                Scope
              </button>

              <span className="flex items-center gap-1.5 normal-case tracking-normal">
                <span className="status-dot status-active" />
                <span className="font-mono text-[11px]">{drones.length}</span>
              </span>
            </div>
          </div>

          <div className="relative flex-1">
            <SkyMap
              drones={drones}
              pods={initialPods}
              missions={liveMissions}
              obstacles={initialObstacles}
              onDroneClick={handleDroneSelect}
              selectedDroneId={selectedDroneId ?? undefined}
              filterType={filterType}
              showRadar={showRadar}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {selectedDrone ? (
            <DronePanel drone={selectedDrone} onClose={() => setSelectedDroneId(null)} />
          ) : (
            <div className="panel flex flex-1 flex-col items-center justify-center p-6 text-center">
              <Crosshair className="mb-3 h-7 w-7 text-text-muted opacity-40" />
              <p className="text-[13px] text-text-secondary">
                Pick an aircraft on the map or in the rail
              </p>
              <p className="mt-1 text-[11.5px] text-text-muted">
                Its telemetry, preflight state and chat open here.
              </p>
            </div>
          )}
          <MissionFeed missions={liveMissions} />
        </div>
      </div>

      <div className="mt-4 h-64">
        <AgentTerminal logs={logs} />
      </div>
    </AppShell>
  );
}

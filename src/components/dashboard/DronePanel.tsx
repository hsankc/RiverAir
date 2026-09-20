"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Map as MapIcon, Battery, Cpu, Navigation, Crosshair,
  Eye, Radio, CheckCircle2, X, TrendingUp,
} from "lucide-react";
import { DroneAgent, droneTypeLabels, statusLabels } from "@/lib/data";
import { locale, statusColor, statusDotClass, typeColor } from "./utils";
import { definitionFor } from "@/lib/fleet";
import { PreflightChecklist } from "./PreflightChecklist";
import { DroneChat } from "./DroneChat";

export function DronePanel({ drone, onClose }: { drone: DroneAgent; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"info" | "checklist" | "chat">("info");

  return (
    <div className="glass-card p-6 space-y-4 animate-slide-in-right overflow-y-auto max-h-[calc(100vh-240px)] no-scrollbar">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-xl">{drone.name}</h3>
        </div>
        <button onClick={onClose} className="p-1 rounded-full text-text-muted hover:bg-white/5 hover:text-text-primary transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className={`status-dot ${statusDotClass(drone.status)}`} />
        <span className={`text-sm font-semibold ${statusColor(drone.status)}`}>
          {statusLabels(locale)[drone.status]}
        </span>
        <span className={`text-xs ml-2 px-2.5 py-0.5 rounded-full border ${typeColor(drone.type)}`}>
          {droneTypeLabels(locale)[drone.type]}
        </span>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-bg-tertiary/40 rounded-sm p-1">
        {([
          { key: "info", label: "Info", icon: Eye },
          { key: "checklist", label: "Preflight", icon: CheckCircle2 },
          { key: "chat", label: "Chat", icon: Radio },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-sm text-[11px] font-semibold transition-all ${
              activeTab === tab.key
                ? "bg-accent-cyan/15 text-accent-cyan shadow-sm"
                : "text-text-muted hover:text-text-primary hover:bg-white/[0.04]"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "info" && (
        <>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-bg-tertiary/60 rounded-sm p-4">
              <div className="text-text-muted text-xs mb-1.5 flex items-center gap-1.5 font-medium uppercase tracking-wider">
                <Battery className="w-3.5 h-3.5" /> Battery
              </div>
              <div className={`text-xl font-bold tabular-nums ${drone.battery < 20 ? "text-danger" : drone.battery < 50 ? "text-warning" : "text-success"}`}>
                %{drone.battery.toFixed(1)}
              </div>
            </div>
            <div className="bg-bg-tertiary/60 rounded-sm p-4">
              <div className="text-text-muted text-xs mb-1.5 flex items-center gap-1.5 font-medium uppercase tracking-wider">
                <Navigation className="w-3.5 h-3.5" /> Speed
              </div>
              <div className="text-xl font-bold tabular-nums">{drone.speed} km/h</div>
            </div>
            <div className="bg-bg-tertiary/60 rounded-sm p-4">
              <div className="text-text-muted text-xs mb-1.5 flex items-center gap-1.5 font-medium uppercase tracking-wider">
                <TrendingUp className="w-3.5 h-3.5" /> Altitude
              </div>
              <div className="text-xl font-bold tabular-nums">{drone.altitude}m</div>
            </div>
            <div className="bg-bg-tertiary/60 rounded-sm p-4">
              <div className="text-text-muted text-xs mb-1.5 flex items-center gap-1.5 font-medium uppercase tracking-wider">
                <Eye className="w-3.5 h-3.5" /> Reputation
              </div>
              <div className="text-xl font-bold tabular-nums text-accent-cyan">{drone.reputation}</div>
            </div>
          </div>

          <div className="bg-bg-tertiary/60 rounded-sm p-4 flex justify-between items-center">
            <div className="text-text-muted text-xs flex items-center gap-1.5 font-medium uppercase tracking-wider">
              <MapIcon className="w-3.5 h-3.5" /> Coordinates
            </div>
            <div className="font-mono font-bold tracking-wide text-sm text-text-primary">
              {drone.lat.toFixed(5)}°N, {drone.lng.toFixed(5)}°E
            </div>
          </div>

          <div className="bg-bg-tertiary/60 rounded-sm p-4">
            <div className="text-text-muted text-xs mb-2 flex items-center gap-1.5 font-medium uppercase tracking-wider">
              <Cpu className="w-3.5 h-3.5" /> Brief
            </div>
            <div className="text-sm font-medium leading-relaxed">{drone.personality}</div>
          </div>

          {/* Base and duties, straight from this aircraft's own definition. */}
          {(() => {
            const def = definitionFor(drone.id);
            if (!def) return null;
            return (
              <div className="bg-bg-tertiary/60 rounded-sm p-4 space-y-3">
                <div className="text-text-muted text-xs flex items-center gap-1.5 font-medium uppercase tracking-wider">
                  <MapIcon className="w-3.5 h-3.5" /> Home base
                </div>
                <div>
                  <div className="text-sm font-medium">{def.base.name}</div>
                  <div className="text-xs text-text-muted mt-0.5">{def.base.kind}</div>
                  <div className="text-[11px] text-text-muted mt-1 font-mono">
                    Launches and lands here · {def.base.lat.toFixed(4)}, {def.base.lng.toFixed(4)}
                  </div>
                </div>

                <div className="text-text-muted text-xs flex items-center gap-1.5 font-medium uppercase tracking-wider pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> What it does
                </div>
                <ul className="space-y-1.5">
                  {def.duties.map((duty) => (
                    <li key={duty} className="text-xs leading-relaxed flex gap-2">
                      <span className="text-accent-cyan shrink-0">—</span>
                      <span className="text-text-secondary">{duty}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-1 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <div className="text-text-muted uppercase tracking-wider">Cruise</div>
                    <div className="font-mono mt-0.5">
                      {def.envelope.cruiseAltitude[0]}–{def.envelope.cruiseAltitude[1]} m
                    </div>
                  </div>
                  <div>
                    <div className="text-text-muted uppercase tracking-wider">Speed</div>
                    <div className="font-mono mt-0.5">
                      {def.envelope.cruiseSpeed[0]}–{def.envelope.cruiseSpeed[1]} km/h
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Specs */}
          <div className="bg-bg-tertiary/60 rounded-sm p-4 space-y-3">
            <div className="text-text-muted text-xs flex items-center gap-1.5 font-medium uppercase tracking-wider">
              <Cpu className="w-3.5 h-3.5" /> Technical Specs
            </div>
            <div className="text-sm font-bold text-accent-cyan">{drone.specs.manufacturer} {drone.specs.model}</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between"><span className="text-text-muted">Max Speed</span><span className="font-semibold tabular-nums">{drone.specs.maxSpeed} km/h</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Max Altitude</span><span className="font-semibold tabular-nums">{drone.specs.maxAltitude}m</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Flight Time</span><span className="font-semibold tabular-nums">{drone.specs.maxFlightTime} min</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Charge Time</span><span className="font-semibold tabular-nums">{drone.specs.chargeTime} min</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Max Payload</span><span className="font-semibold tabular-nums">{drone.specs.maxPayload > 0 ? `${(drone.specs.maxPayload/1000).toFixed(1)} kg` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Price/km</span><span className="font-semibold tabular-nums text-accent-cyan">{drone.specs.pricePerKm} USDC</span></div>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan font-bold">{drone.specs.license}</span>
              <span className="text-[10px] text-text-muted">{drone.specs.sensors.slice(0, 3).join(' • ')}</span>
            </div>
          </div>
        </>
      )}

      {activeTab === "checklist" && <PreflightChecklist drone={drone} />}
      {activeTab === "chat" && <DroneChat drone={drone} />}

      <div className="flex gap-3 pt-2">
        <Link
          href="/control"
          className="flex-1 btn-primary !py-2.5 text-center text-sm rounded-sm font-semibold shadow-md inline-flex justify-center items-center gap-2"
        >
          <Crosshair className="w-4 h-4" />
          <span>Control</span>
        </Link>
        <Link href="/marketplace" className="flex-1 btn-secondary !py-2.5 text-sm rounded-sm font-semibold flex items-center justify-center">
          Assign Mission
        </Link>
      </div>
    </div>
  );
}

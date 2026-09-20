"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { DroneAgent } from "@/lib/data";
import { statusDotClass } from "./utils";

export function FleetList({
  drones,
  selectedDroneId,
  onSelect,
}: {
  drones: DroneAgent[];
  selectedDroneId: number | null;
  onSelect: (drone: DroneAgent) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-1 py-3 mb-2 text-lg font-bold text-[#EDEDED] uppercase tracking-wide hover:text-white transition-colors"
      >
        <span>FLEET ({drones.length})</span>
        <ChevronDown className={`w-5 h-5 text-[#A1A1AA] transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      <div
        className={`overflow-hidden transition-all duration-400 ease-in-out ${
          open ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-1 pt-1 overflow-y-auto max-h-[500px] no-scrollbar">
          {drones.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelect(d)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-left text-sm transition-all ${
                selectedDroneId === d.id
                  ? "bg-accent-cyan/10 text-accent-cyan shadow-sm"
                  : "hover:bg-white/5"
              }`}
            >
              <span className={`status-dot shrink-0 ${statusDotClass(d.status)}`} />
              <span className="flex-1 truncate font-medium">{d.name}</span>
              {/* Mini battery bar */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-8 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      d.battery < 20 ? "bg-danger" : d.battery < 50 ? "bg-warning" : "bg-success"
                    }`}
                    style={{ width: `${d.battery}%` }}
                  />
                </div>
                <span className={`text-[11px] tabular-nums w-7 text-right ${
                  d.battery < 20 ? "text-danger font-bold" : "text-text-muted"
                }`}>
                  {d.battery.toFixed(0)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

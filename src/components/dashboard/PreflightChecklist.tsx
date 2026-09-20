"use client";

import { useState, useEffect, useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { DroneAgent } from "@/lib/data";

export function PreflightChecklist({ drone }: { drone: DroneAgent }) {
  const checks = useMemo(() => [
    { id: "battery", label: "Battery Check", detail: `%${drone.battery.toFixed(0)} — ${drone.battery > 25 ? "Sufficient" : "Insufficient!"}`, autoPass: drone.battery > 25 },
    { id: "gps", label: "GPS Signal", detail: drone.specs.sensors.includes("RTK GPS") ? "RTK FIX ±2cm" : "3D FIX", autoPass: true },
    { id: "motors", label: "Motor Test", detail: `${drone.specs.model} — 4/4 motors nominal`, autoPass: true },
    { id: "sensors", label: "Sensor Calibration", detail: drone.specs.sensors.slice(0, 2).join(", "), autoPass: true },
    { id: "airspace", label: "Airspace Clearance", detail: `${drone.specs.license} — Approved`, autoPass: true },
    { id: "weather", label: "Weather Check", detail: "Wind < 30km/h — Suitable", autoPass: true },
    { id: "payload", label: "Payload Check", detail: drone.specs.maxPayload > 0 ? `Max ${(drone.specs.maxPayload/1000).toFixed(1)}kg — OK` : "No payload", autoPass: true },
    { id: "comms", label: "Comm Link", detail: "Stellar RPC and telemetry connected", autoPass: true },
  ], [drone]);

  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => {
      checks.forEach((c, i) => {
        if (c.autoPass) {
          setTimeout(() => {
            setChecked(prev => new Set([...prev, c.id]));
          }, i * 300);
        }
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [drone.id]);

  const allPassed = checked.size === checks.length;
  const passedCount = checked.size;

  return (
    <div className="bg-bg-tertiary/60 rounded-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-text-muted text-xs flex items-center gap-1.5 font-medium uppercase tracking-wider">
          <CheckCircle2 className="w-3.5 h-3.5" /> Preflight Check
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
          allPassed ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
        }`}>
          {passedCount}/{checks.length}
        </span>
      </div>

      <div className="space-y-1">
        {checks.map((c) => {
          const passed = checked.has(c.id);
          return (
            <button
              key={c.id}
              onClick={() => setChecked(prev => {
                const next = new Set(prev);
                if (next.has(c.id)) next.delete(c.id);
                else next.add(c.id);
                return next;
              })}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-left transition-all duration-300 ${
                passed
                  ? "bg-success/[0.06] border border-success/20"
                  : "bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1]"
              }`}
            >
              <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all duration-300 ${
                passed
                  ? "bg-success border-success text-white"
                  : c.autoPass
                    ? "border-text-muted/40"
                    : "border-warning/60"
              }`}>
                {passed && <CheckCircle2 className="w-3 h-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium truncate ${passed ? "text-success" : "text-text-primary"}`}>
                  {c.label}
                </div>
                <div className="text-[10px] text-text-muted truncate">{c.detail}</div>
              </div>
            </button>
          );
        })}
      </div>

      {allPassed && (
        <div className="flex items-center gap-2 pt-1 text-success text-xs font-semibold animate-fade-in-up">
          <CheckCircle2 className="w-4 h-4" />
          All checks passed — Ready for Flight ✈
        </div>
      )}
    </div>
  );
}

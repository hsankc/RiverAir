"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";
import {
  Clock, ArrowLeft, ChevronRight, Search, Filter,
  Plane, MapPin, Battery, ExternalLink, Package, Tractor,
  Flame, Eye, ArrowUpRight, Download, Radio, Activity,
} from "lucide-react";
import { initialFlightLogs, FlightLog, MissionType, missionTypeLabels } from "@/lib/data";
import { useDroneFleet } from "@/lib/DroneFleetContext";

function typeIcon(t: MissionType) {
  switch (t) {
    case "cargo": return Package;
    case "agricultural": return Tractor;
    case "fire": return Flame;
    case "traffic": return Eye;
  }
}

function typeBadgeColor(t: MissionType) {
  switch (t) {
    case "cargo": return "bg-accent-cyan/15 text-accent-cyan";
    case "agricultural": return "bg-success/15 text-success";
    case "fire": return "bg-danger/15 text-danger";
    case "traffic": return "bg-warning/15 text-warning";
  }
}

/* ─── LIVE FEED — Canlı agent aktivite logları ─── */
function LiveAgentFeed() {
  const [feed, setFeed] = useState<{ time: string; agent: string; action: string; color: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const agents = [
      { name: "FleetAgent", actions: [
        "Scanning for mission-drone matches...",
        "New route calculated for Kadikoy-01",
        "Belgrad-02 redirected for emergency response",
        "Çeşme-03 agricultural op updated",
      ], color: "text-accent-cyan" },
      { name: "EmergencyAgent", actions: [
        "Thermal anomaly scan: sector clear ✓",
        "Battery levels verified",
        "Emergency protocol on standby",
        "Wind speeds within safe limits ✓",
      ], color: "text-danger" },
      { name: "ChargingAgent", actions: [
        "Pod status updated (5/5 active)",
        "Charging session micropayment totalled",
        "Kadıköy Hub energy report generated",
      ], color: "text-warning" },
    ];

    const iv = setInterval(() => {
      const agent = agents[Math.floor(Math.random() * agents.length)];
      const action = agent.actions[Math.floor(Math.random() * agent.actions.length)];
      const now = new Date().toLocaleTimeString("tr-TR");
      setFeed(prev => [...prev.slice(-8), { time: now, agent: agent.name, action, color: agent.color }]);
    }, 3000);

    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [feed]);

  return (
    <div className="glass-card !rounded-xl overflow-hidden mb-8">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-cyan" />
          <span className="text-sm font-semibold">Agent Activity Feed</span>
        </div>
        <span className="text-xs text-success flex items-center gap-1">
          <Radio className="w-3 h-3" /> LIVE
        </span>
      </div>
      <div ref={scrollRef} className="p-4 max-h-[160px] overflow-y-auto no-scrollbar">
        <div className="space-y-2">
          {feed.length === 0 && (
            <div className="text-xs text-text-muted text-center py-4">Listening to agent activity...</div>
          )}
          {feed.map((f, i) => (
            <div key={i} className="flex gap-2 text-xs leading-relaxed animate-fade-in-up">
              <span className="text-text-muted shrink-0">[{f.time}]</span>
              <span className={`shrink-0 font-semibold ${f.color}`}>{f.agent}</span>
              <span className="text-text-muted">→</span>
              <span className="text-text-secondary">{f.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FlightLogsPage() {
  // The seed records carry `new Date(...)` computed when the module loads, so
  // the server and the browser stamp them differently. Filling the table after
  // mount keeps the first client render identical to the server's.
  const [logs, setLogs] = useState<FlightLog[]>([]);
  useEffect(() => setLogs(initialFlightLogs), []);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MissionType | "all">("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const { drones: liveDrones } = useDroneFleet();

  // Simülasyon: her 15 saniyede bir yeni uçuş kaydı ekle
  useEffect(() => {
    const iv = setInterval(() => {
      if (liveDrones.length === 0) return;
      const drone = liveDrones[Math.floor(Math.random() * liveDrones.length)];
      const types: MissionType[] = ["cargo", "agricultural", "fire", "traffic"];
      const missionType = types[Math.floor(Math.random() * types.length)];
      const newLog: FlightLog = {
        id: Date.now(),
        droneId: String(drone.id),
        droneName: drone.name,
        startLat: drone.lat + (Math.random() - 0.5) * 0.05,
        startLng: drone.lng + (Math.random() - 0.5) * 0.05,
        endLat: drone.lat + (Math.random() - 0.5) * 0.1,
        endLng: drone.lng + (Math.random() - 0.5) * 0.1,
        duration: Math.floor(Math.random() * 40 + 8),
        energyUsed: parseFloat((Math.random() * 20 + 5).toFixed(1)),
        missionType,
        txHash: `${Math.random().toString(36).slice(2, 7)}...${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date(),
      };
      setLogs(prev => [newLog, ...prev].slice(0, 30));
    }, 15000);
    return () => clearInterval(iv);
  }, [liveDrones]);

  // Gerçek görev tamamlama eventlerini dinle
  useEffect(() => {
    const handler = ((e: CustomEvent) => {
      const { droneId, droneName, missionTitle } = e.detail;
      const drone = liveDrones.find(d => d.id === droneId);
      const completedLog: FlightLog = {
        id: Date.now() + Math.random(),
        droneId: String(droneId),
        droneName,
        startLat: drone?.lat || 0,
        startLng: drone?.lng || 0,
        endLat: (drone?.lat || 0) + (Math.random() - 0.5) * 0.08,
        endLng: (drone?.lng || 0) + (Math.random() - 0.5) * 0.08,
        duration: Math.floor(Math.random() * 30 + 10),
        energyUsed: parseFloat((Math.random() * 15 + 5).toFixed(1)),
        missionType: drone?.type === "cargo" ? "cargo" : drone?.type === "agricultural" ? "agricultural" : drone?.type === "emergency" ? "fire" : "traffic",
        txHash: `${Math.random().toString(16).slice(2, 10)}…${Math.random().toString(16).slice(2, 8)}`,
        timestamp: new Date(),
      };
      setLogs(prev => [completedLog, ...prev].slice(0, 30));
    }) as EventListener;
    window.addEventListener("mission-complete", handler);
    return () => window.removeEventListener("mission-complete", handler);
  }, [liveDrones]);

  // CSV Export
  const handleExport = () => {
    const header = "ID,Drone,Type,Duration(min),Energy(kWh),TX Hash,Time\n";
    const rows = logs.map(l =>
      `${l.id},${l.droneName},${l.missionType},${l.duration},${l.energyUsed},${l.txHash},${l.timestamp.toISOString()}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "riverair-flight-log.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = logs
    .filter((l) => filter === "all" || l.missionType === filter)
    .filter(
      (l) =>
        l.droneName.toLowerCase().includes(search.toLowerCase()) ||
        l.txHash.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-text-muted hover:text-accent-cyan">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Link href="/" className="flex items-center gap-2">
                  <BrandLockup size={28} />
                </Link>
                <ChevronRight className="w-4 h-4 text-text-muted" />
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-accent-cyan" />
                  Flight Logs (On-Chain)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-border text-xs font-medium text-text-secondary hover:bg-white/10 hover:text-accent-cyan transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                CSV Export
              </button>
              <div className="text-xs text-text-muted flex items-center gap-2">
                <span className="status-dot status-active" />
                {logs.length} Records
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Live Agent Feed */}
        <LiveAgentFeed />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Flights", value: logs.length, color: "text-accent-cyan" },
            { label: "Total Duration", value: `${logs.reduce((a, l) => a + l.duration, 0)} min`, color: "text-accent-violet" },
            { label: "Total Energy", value: `${logs.reduce((a, l) => a + l.energyUsed, 0).toFixed(1)} kWh`, color: "text-warning" },
            { label: "On-Chain TX", value: logs.length, color: "text-success" },
          ].map((s) => (
            <div key={s.label} className="glass-card !rounded-xl p-4">
              <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
              <div className="text-xs text-text-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search drone name or TX hash..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-cyan transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "cargo", "agricultural", "fire", "traffic"] as (MissionType | "all")[]).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  filter === t
                    ? "bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30"
                    : "bg-white/5 text-text-secondary border border-transparent hover:bg-white/10"
                }`}
              >
                {t === "all" ? "All" : missionTypeLabels("en")[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="glass-card !rounded-xl overflow-hidden">
          {/* Desktop table header */}
          <div className="hidden md:grid grid-cols-7 gap-4 px-5 py-3 text-xs font-medium text-text-muted border-b border-border bg-white/3">
            <div>ID</div>
            <div>Drone</div>
            <div>Route</div>
            <div>Type</div>
            <div>Duration & Energy</div>
            <div>TX Hash</div>
            <div>Time</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {filtered.map((log) => {
              const Icon = typeIcon(log.missionType);
              const isNew = Date.now() - log.timestamp.getTime() < 20000;
              return (
                <div
                  key={log.id}
                  className={`hover:bg-white/3 transition-colors cursor-pointer ${isNew ? "bg-accent-cyan/[0.03] border-l-2 border-l-accent-cyan" : ""}`}
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                >
                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-7 gap-4 px-5 py-4 items-center text-sm">
                    <div className="font-mono text-text-muted">#{String(log.id).slice(-4)}</div>
                    <div className="flex items-center gap-2">
                      <Plane className={`w-4 h-4 ${isNew ? "text-accent-cyan animate-pulse" : "text-accent-cyan"}`} />
                      <span className="font-medium">{log.droneName}</span>
                    </div>
                    <div className="font-mono text-xs text-text-secondary">
                      {log.startLat.toFixed(2)}° → {log.endLat.toFixed(2)}°
                    </div>
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${typeBadgeColor(log.missionType)}`}>
                        {missionTypeLabels("en")[log.missionType]}
                      </span>
                    </div>
                    <div className="text-xs text-text-secondary">
                      {log.duration}min / {log.energyUsed}kWh
                    </div>
                    <div className="font-mono text-xs text-accent-cyan flex items-center gap-1">
                      {log.txHash}
                      <ExternalLink className="w-3 h-3" />
                    </div>
                    <div className="text-xs text-text-muted">
                      {log.timestamp.toLocaleTimeString("tr-TR")}
                    </div>
                  </div>

                  {/* Mobile card */}
                  <div className="md:hidden p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Plane className="w-4 h-4 text-accent-cyan" />
                        <span className="font-medium">{log.droneName}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${typeBadgeColor(log.missionType)}`}>
                        {missionTypeLabels("en")[log.missionType]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-text-muted">
                      <span>{log.duration}min / {log.energyUsed}kWh</span>
                      <span className="font-mono text-xs text-accent-cyan">{log.txHash}</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expanded === log.id && (
                    <div className="px-5 pb-4 animate-fade-in-up">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-white/3 rounded-lg text-sm">
                        <div>
                          <div className="text-xs text-text-muted mb-1">Takeoff</div>
                          <div className="font-mono text-xs">{log.startLat.toFixed(4)}°N, {log.startLng.toFixed(4)}°E</div>
                        </div>
                        <div>
                          <div className="text-xs text-text-muted mb-1">Landing</div>
                          <div className="font-mono text-xs">{log.endLat.toFixed(4)}°N, {log.endLng.toFixed(4)}°E</div>
                        </div>
                        <div>
                          <div className="text-xs text-text-muted mb-1">Duration</div>
                          <div className="font-bold">{log.duration} minutes</div>
                        </div>
                        <div>
                          <div className="text-xs text-text-muted mb-1">Energy</div>
                          <div className="font-bold">{log.energyUsed} kWh</div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-text-muted text-center">
                        {"This data is simulated for the hackathon demo - Aviation Blackbox 🛸"}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

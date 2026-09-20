"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Radio, Crosshair, MapPin, Navigation, TrendingUp, ChevronDown, Battery } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { initialDrones } from "@/lib/data";

export default function ControlPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [txCount, setTxCount] = useState(0);
  const [logs, setLogs] = useState<{ time: string; msg: string; type: string }[]>([]);
  const [altitude, setAltitude] = useState(10);
  const [bearing, setBearing] = useState(0);
  const [coords, setCoords] = useState("41.0430, 29.0080");
  const [isStarted, setIsStarted] = useState(false);
  const [selectedDroneId, setSelectedDroneId] = useState(1);
  const [showDroneSelect, setShowDroneSelect] = useState(false);
  const [droneBattery, setDroneBattery] = useState(87);
  const [notification, setNotification] = useState<string | null>(null);

  // Drone değiştiğinde kamerayı yeni drone'un konumuna götür
  useEffect(() => {
    const drone = initialDrones.find(d => d.id === selectedDroneId);
    if (drone) {
      targetCam.current = { lng: drone.lng, lat: drone.lat, alt: drone.altitude || 250, bearing: drone.heading || 0 };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDroneBattery(Math.round(drone.battery));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCoords(`${drone.lat.toFixed(5)}N, ${drone.lng.toFixed(5)}E`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAltitude(drone.altitude || 10);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBearing(Math.round(drone.heading || 0));
    }
  }, [selectedDroneId]);

  const appendLog = React.useCallback((msg: string, type: string = "info") => {
    const time = new Date().toLocaleTimeString("tr-TR", { hour12: false });
    setLogs((prev) => [{ time, msg, type }, ...prev].slice(0, 30));
  }, []);

  // Görev tamamlama eventlerini dinle
  useEffect(() => {
    const handler = ((e: CustomEvent) => {
      const { droneName, missionTitle } = e.detail;
      setNotification(`🎯 ${droneName} — "${missionTitle}" completed!`);
      appendLog(`[FLEET] ${droneName} → "${missionTitle}" COMPLETED`, "success");
      setTimeout(() => setNotification(null), 5000);
    }) as EventListener;
    window.addEventListener("mission-complete", handler);
    return () => window.removeEventListener("mission-complete", handler);
  }, [appendLog]);

  // Target & Current state refs (for physics/lerp)
  const targetCam = useRef({ lng: 29.0080, lat: 41.0430, alt: 10, bearing: 0 });
  const currentCam = useRef({ lng: 29.0080, lat: 41.0430, alt: 10, bearing: 0 });
  const keys = useRef<Record<string, boolean>>({});
  const modeRef = useRef<"cinematic" | "sport">("sport");
  const [uiMode, setUiMode] = useState<"cinematic" | "sport">("sport");


  useEffect(() => {
    if (!mapContainer.current) return;

    // ── MAPLIBRE GL JS INIT (OpenFreeMap: 3D bina desteği olan açık kaynaklı stil) ──
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/dark",
      center: [29.0080, 41.0430], 
      zoom: 17.5,
      pitch: 85,
      bearing: 0,
      interactive: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      appendLog("Sky-Sync Protocol Started", "success");
      appendLog("Stellar testnet link established (simulated flight)", "success");
      
      // Cyberpunk 3D Bina Extrusion (Bina yüksekliklerini kullanarak gerçek 3D görünümü)
      map.addLayer({
        id: "cyberpunk-3d-buildings",
        source: "openmaptiles",
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 15,
        paint: {
          // Binaları neon mor ve yeşil arası renklerde yüksekliklerine göre boyuyoruz
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["get", "render_height"],
            0, "#836ef1",    // Kısa binalar neon mor
            20, "#000000",   // Duvarlar siyah
            300, "#39ff65",  // Gökdelenler neon yeşil
          ],
          "fill-extrusion-height": ["get", "render_height"],
          "fill-extrusion-base": ["get", "render_min_height"],
          "fill-extrusion-opacity": 0.8,
        },
      });

      // Yol ağını neon yap (Grid efekti)
      const layers = map.getStyle().layers;
      if (layers) {
        layers.forEach((l) => {
          if (l.type === "line" && l.id.toLowerCase().includes("road")) {
            map.setPaintProperty(l.id, "line-color", "rgba(57, 255, 101, 0.4)");
          }
        });
      }

      startEngine();
    });

    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;
    const lerpAngle = (start: number, end: number, factor: number) => {
      let diff = end - start;
      while (diff < -180) diff += 360;
      while (diff > 180) diff -= 360;
      return start + diff * factor;
    };

    const startEngine = () => {
      const lastTxTimes: Record<string, number> = {};
      const TX_DEBOUNCE_MS = 500;

      const flightLoop = () => {
        if (!mapRef.current) return;
        
        let moving = false;
        const activeMoves: string[] = [];

        const isSport = modeRef.current === "sport";
        // Realistic speeds: 0.000003 (approx 70km/h) for Sport, 0.0000008 (approx 18km/h) for Cinematic
        const moveThrust = isSport ? 0.000003 : 0.0000008;
        const rotateThrust = isSport ? 1.0 : 0.3;
        const altThrust = isSport ? 0.2 : 0.05;
        const rad = targetCam.current.bearing * (Math.PI / 180);

        if (keys.current["KeyW"] || keys.current["ArrowUp"]) {
          targetCam.current.lat += Math.cos(rad) * moveThrust;
          targetCam.current.lng += Math.sin(rad) * moveThrust;
          activeMoves.push("THRUST_FORWARD");
          moving = true;
        }
        if (keys.current["KeyS"] || keys.current["ArrowDown"]) {
          targetCam.current.lat -= Math.cos(rad) * moveThrust;
          targetCam.current.lng -= Math.sin(rad) * moveThrust;
          activeMoves.push("THRUST_REVERSE");
          moving = true;
        }
        if (keys.current["KeyA"] || keys.current["ArrowLeft"]) {
          targetCam.current.lat += Math.cos(rad - Math.PI / 2) * moveThrust;
          targetCam.current.lng += Math.sin(rad - Math.PI / 2) * moveThrust;
          activeMoves.push("STRAFE_LEFT");
          moving = true;
        }
        if (keys.current["KeyD"] || keys.current["ArrowRight"]) {
          targetCam.current.lat += Math.cos(rad + Math.PI / 2) * moveThrust;
          targetCam.current.lng += Math.sin(rad + Math.PI / 2) * moveThrust;
          activeMoves.push("STRAFE_RIGHT");
          moving = true;
        }

        if (keys.current["KeyQ"]) {
          targetCam.current.bearing -= rotateThrust;
          activeMoves.push("YAW_LEFT");
          moving = true;
        }
        if (keys.current["KeyE"]) {
          targetCam.current.bearing += rotateThrust;
          activeMoves.push("YAW_RIGHT");
          moving = true;
        }

        if (keys.current["Space"]) {
          targetCam.current.alt += altThrust;
          activeMoves.push("ASCEND");
          moving = true;
        }
        if (keys.current["ShiftLeft"] || keys.current["ShiftRight"]) {
          targetCam.current.alt = Math.max(5, targetCam.current.alt - altThrust);
          activeMoves.push("DESCEND");
          moving = true;
        }

        // Lerp physics
        const f = 0.12;
        currentCam.current.lat = lerp(currentCam.current.lat, targetCam.current.lat, f);
        currentCam.current.lng = lerp(currentCam.current.lng, targetCam.current.lng, f);
        currentCam.current.alt = lerp(currentCam.current.alt, targetCam.current.alt, f);
        currentCam.current.bearing = lerpAngle(currentCam.current.bearing, targetCam.current.bearing, f);

        // UI Updates
        setAltitude(Math.round(currentCam.current.alt));
        setBearing(Math.round(currentCam.current.bearing));
        setCoords(`${currentCam.current.lat.toFixed(5)}N, ${currentCam.current.lng.toFixed(5)}E`);

        // Apply to Map (Safely check if style is ready)
        if (mapRef.current.style && mapRef.current.style._loaded) {
          mapRef.current.setCenter([currentCam.current.lng, currentCam.current.lat]);
          mapRef.current.setBearing(currentCam.current.bearing);
          mapRef.current.setZoom(Math.max(1, 22 - Math.log2(currentCam.current.alt)));
        }

        // TX Streaming
        if (moving) {
          const now = performance.now();
          activeMoves.forEach((move) => {
            if (now - (lastTxTimes[move] || 0) > TX_DEBOUNCE_MS) {
              lastTxTimes[move] = now;
              setTxCount((c) => c + 1);
              appendLog(`[SIM] Mission::${move}()`, "warning");
              setTimeout(() => {
                appendLog(`[SIM] ${move}() saved. Demo Tx: ${Math.random().toString(16).slice(2, 10)}...`, "success");
              }, 400);
            }
          });
        }

        requestAnimationFrame(flightLoop);
      };

      requestAnimationFrame(flightLoop);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (mapRef.current) mapRef.current.remove();
    };
  }, [appendLog]);

  return (
    <div className="relative h-screen bg-black overflow-hidden font-mono text-accent-cyan select-none">
      {/* HARİTA KONTEYNERI */}
      <div 
        ref={mapContainer} 
        className="absolute inset-0 z-0 bg-neutral-900" 
        style={{ width: '100vw', height: '100vh' }} 
      />
      
      {/* HUD OVERLAYS */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-b from-accent-violet/15 via-transparent to-accent-cyan/15" />

      {/* HEADER */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-[100] pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <Link href="/dashboard" className="w-10 h-10 rounded-full bg-black/80 border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              RIVERAIR <span className="text-accent-violet">:: SKY-SYNC</span>
            </h1>
            <p className="text-[10px] tracking-[4px] text-accent-violet font-bold uppercase">TRUE FPV ON-CHAIN CONTROL</p>
          </div>
        </div>
        <div className="relative pointer-events-auto">
            <button
              onClick={() => setShowDroneSelect(!showDroneSelect)}
              className="bg-black/80 border border-success/40 px-4 py-2 rounded-sm text-right min-w-[200px]"
            >
              <div className="text-[10px] text-success/70 font-bold mb-1 uppercase tracking-widest">CONNECTED AGENT</div>
              <div className="flex items-center gap-2 justify-end">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-sm font-bold text-white uppercase">
                  {initialDrones.find(d => d.id === selectedDroneId)?.name || "Kadikoy-01"}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${showDroneSelect ? "rotate-180" : ""}`} />
              </div>
              <div className="flex items-center gap-1.5 justify-end mt-1">
                <Battery className={`w-3 h-3 ${droneBattery < 20 ? "text-danger" : droneBattery < 50 ? "text-warning" : "text-success"}`} />
                <span className={`text-[10px] font-bold tabular-nums ${droneBattery < 20 ? "text-danger" : "text-success"}`}>%{droneBattery}</span>
                <span className="text-[10px] text-text-muted ml-1">
                  {initialDrones.find(d => d.id === selectedDroneId)?.specs.model}
                </span>
              </div>
            </button>

            {/* Dropdown */}
            {showDroneSelect && (
              <div className="absolute right-0 top-full mt-1 bg-black/95 border border-white/10 rounded-sm w-64 z-[70] shadow-2xl">
                {initialDrones.map(d => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setSelectedDroneId(d.id);
                      setShowDroneSelect(false);
                      setDroneBattery(Math.round(d.battery));
                      // Kamerayı drone konumuna taşı
                      targetCam.current.lat = d.lat;
                      targetCam.current.lng = d.lng;
                      targetCam.current.alt = d.altitude || 10;
                      appendLog(`Agent switched → ${d.name} (${d.specs.model})`, "success");
                      appendLog(`Pos: ${d.lat.toFixed(4)}°N, ${d.lng.toFixed(4)}°E | Alt: ${d.altitude}m`, "info");
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-white/5 ${
                      selectedDroneId === d.id ? "bg-success/10 border-l-2 border-l-success" : ""
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${d.status === "in-flight" || d.status === "mission" ? "bg-success" : d.status === "charging" ? "bg-warning" : "bg-text-muted"}`} />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-white">{d.name}</div>
                      <div className="text-[10px] text-text-muted">{d.specs.model} • %{d.battery.toFixed(0)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* TERMINAL */}
      <div className="absolute top-28 right-6 w-80 h-[450px] bg-black/85 border border-accent-violet/30 rounded-sm z-50 pointer-events-auto flex flex-col shadow-[0_0_30px_rgba(131,110,241,0.2)]">
        <div className="p-3 bg-accent-violet/20 border-b border-accent-violet/30 flex justify-between items-center">
          <span className="text-[10px] font-bold tracking-widest flex items-center gap-2">
            <Radio className="w-3 h-3 text-white animate-pulse" /> STELLAR TX STREAM
          </span>
          <span className="text-[8px] px-1.5 py-0.5 border border-accent-violet/50 rounded-sm">~5s LEDGER</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {logs.map((log, i) => (
            <div key={i} className="text-[11px] leading-tight animate-fade-in">
              <span className="text-accent-violet mr-1.5">[{log.time}]</span>
              <span className={log.type === "success" ? "text-success" : log.type === "warning" ? "text-warning" : "text-white opacity-80"}>
                {log.msg}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* START MODAL */}
      {!isStarted && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto">
          <button 
            onClick={() => {
              setIsStarted(true);
              appendLog("3D Cyberpunk Engine Activated", "success");
            }}
            className="group relative px-10 py-6 border border-accent-cyan/40 hover:border-accent-cyan transition-all"
          >
            <div className="absolute -inset-0.5 bg-accent-cyan/20 blur opacity-0 group-hover:opacity-100 transition-all" />
            <div className="relative flex flex-col items-center gap-4">
              <Crosshair className="w-16 h-16 text-accent-cyan mb-2" />
              <div className="text-center">
                <div className="text-2xl font-black text-white mb-2 tracking-tighter uppercase">START FLIGHT</div>
                <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-[10px] font-bold text-accent-cyan/80">
                  <div className="flex items-center gap-2 uppercase tracking-widest"><span className="px-1.5 py-0.5 bg-accent-cyan text-black">W/S</span> FORWARD / BACK</div>
                  <div className="flex items-center gap-2 uppercase tracking-widest"><span className="px-1.5 py-0.5 bg-accent-cyan text-black">A/D</span> LEFT / RIGHT</div>
                  <div className="flex items-center gap-2 uppercase tracking-widest"><span className="px-1.5 py-0.5 bg-accent-cyan text-black">Q/E</span> TURN YAW</div>
                  <div className="flex items-center gap-2 uppercase tracking-widest"><span className="px-1.5 py-0.5 bg-accent-cyan text-black">ESC</span> RELEASE MOUSE</div>
                </div>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* CROSSHAIR */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none opacity-40">
        <div className="w-20 h-20 rounded-full border border-dashed border-accent-violet animate-spin-slow flex items-center justify-center">
          <div className="w-10 h-[1px] bg-success" />
          <div className="h-10 w-[1px] bg-success absolute" />
        </div>
      </div>

      {/* TELEMETRY FOOTER */}
      <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end z-50 pointer-events-none flex-wrap gap-4">
        <div className="flex gap-4 pointer-events-auto">
          <div className="bg-black/85 border-l-4 border-success p-4 min-w-[150px]">
            <div className="text-[10px] text-accent-violet font-bold mb-1 uppercase tracking-widest">COORDS</div>
            <div className="text-xl font-black text-white">{coords}</div>
          </div>
          <div className="bg-black/85 border-l-4 border-accent-cyan p-4 min-w-[120px]">
             <div className="text-[10px] text-accent-violet font-bold mb-1 uppercase tracking-widest">ALTITUDE</div>
             <div className="text-xl font-black text-white">{altitude}m</div>
          </div>
          <div className="bg-black/85 border-l-4 border-accent-cyan p-4 min-w-[120px]">
             <div className="text-[10px] text-accent-violet font-bold mb-1 uppercase tracking-widest">YAW</div>
             <div className="text-xl font-black text-white">{bearing}°</div>
          </div>
          <div className="bg-black/85 border-l-4 border-accent-violet p-4 min-w-[120px]">
             <div className="text-[10px] text-accent-violet font-bold mb-1 uppercase tracking-widest">FLIGHT MODE</div>
             <button 
               onClick={() => {
                 const newMode = uiMode === "sport" ? "cinematic" : "sport";
                 setUiMode(newMode);
                 modeRef.current = newMode;
                 appendLog(`Flight Mode: ${newMode.toUpperCase()}`, "info");
               }}
               className={`text-lg font-black uppercase transition-colors ${uiMode === "sport" ? "text-warning" : "text-success"}`}
             >
               {uiMode === "sport" ? "SPORT" : "CINEMATIC"}
             </button>
          </div>
          <div className="bg-black/85 border-l-4 border-accent-violet p-4 min-w-[120px]">
             <div className="text-[10px] text-accent-violet font-bold mb-1 uppercase tracking-widest">STREAMED TX</div>
             <div className="text-xl font-black text-white">{txCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

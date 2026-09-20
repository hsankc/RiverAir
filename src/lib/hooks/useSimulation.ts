import { useState, useEffect, useCallback, useRef } from "react";
import {
  initialDrones,
  initialMissions,
  initialObstacles,
  initialPods,
  DroneAgent,
  FlightPhase,
  Mission,
  MissionType,
} from "@/lib/data";
import { pickRandomMission } from "@/lib/missions";
import { definitionFor } from "@/lib/fleet";
import { FlightSimulator } from "@/lib/simulation";
import { buildFieldSweepPath } from "@/lib/agriculturalSweep";

/**
 * Autonomous fleet simulation.
 *
 * Every aircraft runs its own loop: it claims work it is rated for, takes off
 * from its own pad, flies out to the site, does the job its type does, and
 * comes back to the same pad. Nobody drives it and nothing is on rails — one
 * that runs low on battery hands the job back, flies home and charges.
 *
 * How each aircraft flies is not decided here. It comes from that aircraft's
 * own file under `src/lib/fleet/`: its base, the work it accepts, its altitude
 * and speed envelope, and what it does once it arrives.
 */

const TICK_MS = 2000;

/**
 * Wall-clock is compressed so a cross-city leg reads in a couple of minutes
 * instead of the forty it would really take. Everything else — speeds,
 * altitudes, climb rates — stays in real units.
 */
const TIME_SCALE = 16;

/** Degrees of latitude per kilometre, near enough at this latitude. */
const DEG_PER_KM = 1 / 111;

/** İstanbul operating area. */
const BOUNDS = { minLat: 40.78, maxLat: 41.35, minLng: 28.1, maxLng: 29.72 };

/**
 * Keep this many missions of EACH type on the board. Topping up by total count
 * is not enough: `pickRandomMission()` draws uniformly from the template pool,
 * and cargo templates outnumber the rest roughly two to one, so a board stocked
 * by total would starve the sprayers and observers while the couriers queued.
 */
const MIN_OPEN_PER_TYPE = 3;

const MISSION_TYPES: MissionType[] = ["cargo", "agricultural", "fire", "traffic"];

const between = ([lo, hi]: [number, number]) => lo + Math.random() * (hi - lo);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function distanceDeg(aLat: number, aLng: number, bLat: number, bLng: number) {
  return Math.hypot(bLat - aLat, bLng - aLng);
}

function bearing(aLat: number, aLng: number, bLat: number, bLng: number) {
  const deg = (Math.atan2(bLng - aLng, bLat - aLat) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Degrees covered in one tick at a given ground speed. */
function stepFor(speedKmh: number) {
  return (speedKmh / 3600) * (TICK_MS / 1000) * TIME_SCALE * DEG_PER_KM;
}

function nearestPod(lat: number, lng: number) {
  return initialPods.reduce((best, pod) =>
    distanceDeg(lat, lng, pod.lat, pod.lng) < distanceDeg(lat, lng, best.lat, best.lng) ? pod : best,
  );
}

/** Per-drone scratch state the agent itself does not need to carry. */
interface Scratch {
  cruiseAlt: number;
  cruiseSpeed: number;
  sweep?: { index: number; path: [number, number][] };
  orbitAngle: number;
  workTicksLeft: number;
}

export function useDroneSimulator() {
  const [drones, setDrones] = useState<DroneAgent[]>(() =>
    initialDrones.map((d) => ({ ...d, phase: "grounded" as FlightPhase })),
  );
  const [liveMissions, setLiveMissions] = useState<Mission[]>(() => [...initialMissions]);

  const dronesRef = useRef(drones);
  const missionsRef = useRef(liveMissions);
  useEffect(() => { dronesRef.current = drones; }, [drones]);
  useEffect(() => { missionsRef.current = liveMissions; }, [liveMissions]);

  const scratch = useRef<Map<number, Scratch>>(new Map());

  const emitMissionComplete = useCallback(
    (droneId: number, missionId: number, droneName: string, missionTitle: string) => {
      window.dispatchEvent(
        new CustomEvent("mission-complete", {
          detail: { droneId, missionId, droneName, missionTitle, timestamp: new Date() },
        }),
      );
    },
    [],
  );

  // ── Manual commands from the dispatcher ──
  useEffect(() => {
    const handleAiCommand = ((e: CustomEvent) => {
      const cmd = e.detail;
      if (!cmd) return;

      setDrones((prev) =>
        prev.map((d) => {
          if (cmd.action === "sendCommand" && cmd.params?.droneId === d.id) {
            const command = cmd.params.command;
            const sc = scratch.current.get(d.id);

            if (command === "TakeOff") {
              return { ...d, status: "in-flight", phase: "takeoff" };
            }
            if (command === "Land") {
              if (cmd.params.destLat && cmd.params.destLng) {
                return {
                  ...d,
                  status: "in-flight",
                  phase: "cruise",
                  targetLat: cmd.params.destLat,
                  targetLng: cmd.params.destLng,
                };
              }
              return { ...d, status: "in-flight", phase: "landing" };
            }
            if (command === "RTB") {
              const pod = nearestPod(d.lat, d.lng);
              return { ...d, status: "in-flight", phase: "return", targetLat: pod.lat, targetLng: pod.lng };
            }
            if (command === "Hover") {
              return { ...d, speed: 0 };
            }
            if (command === "Up" && sc) {
              sc.cruiseAlt = clamp(sc.cruiseAlt + 50, 20, 320);
            }
            if (command === "Down" && sc) {
              sc.cruiseAlt = clamp(sc.cruiseAlt - 50, 20, 320);
            }
            const headings: Record<string, number> = { North: 0, South: 180, East: 90, West: 270 };
            if (command in headings) return { ...d, heading: headings[command] };
          }
          return d;
        }),
      );
    }) as EventListener;

    window.addEventListener("ai-command", handleAiCommand);
    return () => window.removeEventListener("ai-command", handleAiCommand);
  }, []);

  // ── The loop ──
  useEffect(() => {
    const iv = setInterval(() => {
      const missions = [...missionsRef.current];
      const byId = new Map(missions.map((m) => [m.id, m]));
      const completed: { droneId: number; missionId: number; droneName: string; title: string }[] = [];

      // Keep the board stocked, per discipline, so no aircraft sits idle
      // waiting for work only it can do.
      for (const type of MISSION_TYPES) {
        let open = missions.filter((m) => m.status === "open" && m.type === type).length;
        while (open < MIN_OPEN_PER_TYPE) {
          const m = pickRandomMission(type);
          missions.push(m);
          byId.set(m.id, m);
          open++;
        }
      }

      const claimed = new Set<number>();

      const nextDrones = dronesRef.current.map((drone) => {
        const def = definitionFor(drone.id);
        if (!def) return drone;

        // Everything about how this aircraft flies comes from its own file.
        const profile = {
          cruiseAlt: def.envelope.cruiseAltitude,
          cruiseSpeed: def.envelope.cruiseSpeed,
          climbRate: def.envelope.climbRate,
          drain: def.envelope.drainPerTick,
          work: def.onSite,
          orbitRadius: def.orbitRadius,
          workTicks: def.onSiteTicks,
        };

        let sc = scratch.current.get(drone.id);
        if (!sc) {
          sc = {
            cruiseAlt: Math.round(between(profile.cruiseAlt)),
            cruiseSpeed: Math.round(between(profile.cruiseSpeed)),
            orbitAngle: Math.random() * Math.PI * 2,
            workTicksLeft: 0,
          };
          scratch.current.set(drone.id, sc);
        }

        const d = { ...drone };
        const phase: FlightPhase = d.phase ?? "grounded";
        const mission = d.missionId != null ? byId.get(d.missionId) : undefined;

        // ── On a pod ──
        if (d.status === "charging") {
          const battery = Math.min(100, d.battery + 0.9 + Math.random() * 0.4);
          if (battery >= 99) {
            return { ...d, battery: 100, status: "idle" as const, phase: "grounded" as FlightPhase, altitude: 0, speed: 0 };
          }
          return { ...d, battery, altitude: 0, speed: 0 };
        }

        // ── Waiting for work ──
        if (phase === "grounded") {
          if (d.battery < 45) {
            if (distanceDeg(d.lat, d.lng, def.base.lat, def.base.lng) < 0.01) {
              return { ...d, status: "charging" as const, speed: 0, altitude: 0 };
            }
            return {
              ...d,
              status: "in-flight" as const,
              phase: "return" as FlightPhase,
              targetLat: def.base.lat,
              targetLng: def.base.lng,
            };
          }

          // Claim a mission this airframe is rated for. Always taking the
          // nearest makes the fleet converge on one district and fly the same
          // lines, so each drone picks at random from the few closest to it.
          const candidates = missions
            .filter(
              (m) => m.status === "open" && !claimed.has(m.id) && def.accepts.includes(m.type),
            )
            .sort(
              (a, b) =>
                distanceDeg(d.lat, d.lng, a.fromLat, a.fromLng) -
                distanceDeg(d.lat, d.lng, b.fromLat, b.fromLng),
            );

          if (candidates.length === 0) return { ...d, speed: 0, altitude: 0 };
          const best = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];

          claimed.add(best.id);
          byId.set(best.id, { ...best, status: "accepted", droneId: d.id });
          sc.sweep = undefined;
          sc.workTicksLeft = profile.workTicks;
          sc.cruiseAlt = Math.round(between(profile.cruiseAlt));
          sc.cruiseSpeed = Math.round(between(profile.cruiseSpeed));

          return {
            ...d,
            status: "mission" as const,
            phase: "takeoff" as FlightPhase,
            missionId: best.id,
            targetLat: best.fromLat,
            targetLng: best.fromLng,
            heading: bearing(d.lat, d.lng, best.fromLat, best.fromLng),
            speed: 0,
          };
        }

        // ── Climbing out ──
        if (phase === "takeoff") {
          const altitude = d.altitude + profile.climbRate;
          const battery = Math.max(0, d.battery - profile.drain * 1.8);
          if (altitude >= sc.cruiseAlt) {
            return { ...d, altitude: sc.cruiseAlt, speed: sc.cruiseSpeed, battery, phase: "cruise" as FlightPhase };
          }
          return {
            ...d,
            altitude: Math.round(altitude),
            speed: Math.round(sc.cruiseSpeed * (altitude / sc.cruiseAlt) * 0.6),
            battery,
          };
        }

        // ── Descending ──
        if (phase === "landing") {
          const altitude = d.altitude - profile.climbRate * 1.3;
          const battery = Math.max(0, d.battery - profile.drain * 0.6);
          if (altitude <= 0) {
            const home = distanceDeg(d.lat, d.lng, def.base.lat, def.base.lng) < 0.01;
            return {
              ...d,
              altitude: 0,
              speed: 0,
              battery,
              status: home && battery < 90 ? ("charging" as const) : ("idle" as const),
              phase: "grounded" as FlightPhase,
              targetLat: undefined,
              targetLng: undefined,
            };
          }
          return { ...d, altitude: Math.round(altitude), speed: Math.round(d.speed * 0.7), battery };
        }

        // ── Everything below is airborne and moving ──
        let lat = d.lat;
        let lng = d.lng;
        let heading = d.heading;
        let speed = sc.cruiseSpeed;
        let altitude = d.altitude;
        let nextPhase: FlightPhase = phase;
        let status: DroneAgent["status"] = d.status;
        let missionId = d.missionId;
        let targetLat = d.targetLat;
        let targetLng = d.targetLng;

        const flyTo = (tLat: number, tLng: number, kmh: number) => {
          const dist = distanceDeg(lat, lng, tLat, tLng);
          const step = stepFor(kmh);
          heading = bearing(lat, lng, tLat, tLng);
          if (dist <= step) { lat = tLat; lng = tLng; return true; }
          lat += ((tLat - lat) / dist) * step;
          lng += ((tLng - lng) / dist) * step;
          return false;
        };

        if (phase === "return") {
          if (flyTo(def.base.lat, def.base.lng, sc.cruiseSpeed)) nextPhase = "landing";
          status = d.battery < 20 ? "emergency" : "in-flight";
        } else if (phase === "cruise") {
          // Outbound leg to the pickup point.
          if (!mission) {
            nextPhase = "landing";
          } else if (flyTo(mission.fromLat, mission.fromLng, sc.cruiseSpeed)) {
            nextPhase = "onsite";
            byId.set(mission.id, { ...mission, status: "in-progress", droneId: d.id });
            targetLat = mission.toLat;
            targetLng = mission.toLng;
            if (profile.work === "sweep") {
              sc.sweep = { index: 0, path: buildFieldSweepPath(mission) };
            }
          }
        } else if (phase === "onsite" && mission) {
          if (profile.work === "deliver") {
            // Carry the load to the drop-off, then put it down.
            if (flyTo(mission.toLat, mission.toLng, sc.cruiseSpeed)) {
              completed.push({ droneId: d.id, missionId: mission.id, droneName: d.name, title: mission.title });
              byId.set(mission.id, { ...mission, status: "completed" });
              missionId = null;
              nextPhase = "return";
              targetLat = def.base.lat;
              targetLng = def.base.lng;
            }
          } else if (profile.work === "sweep") {
            // Crawl the field on a lawnmower pattern, low and slow.
            const sweep = sc.sweep ?? (sc.sweep = { index: 0, path: buildFieldSweepPath(mission) });
            altitude = Math.round(clamp(altitude - 4, profile.cruiseAlt[0], sc.cruiseAlt));
            if (sweep.index >= sweep.path.length) {
              completed.push({ droneId: d.id, missionId: mission.id, droneName: d.name, title: mission.title });
              byId.set(mission.id, { ...mission, status: "completed" });
              missionId = null;
              nextPhase = "return";
              targetLat = def.base.lat;
              targetLng = def.base.lng;
            } else {
              const [wLat, wLng] = sweep.path[sweep.index];
              if (flyTo(wLat, wLng, sc.cruiseSpeed)) sweep.index += 1;
              speed = sc.cruiseSpeed;
            }
          } else {
            // Orbit or hold over the site until the survey is done.
            const centreLat = mission.toLat;
            const centreLng = mission.toLng;
            sc.orbitAngle += profile.work === "orbit" ? 0.38 : 0.55;
            const r = profile.orbitRadius;
            const tLat = centreLat + Math.cos(sc.orbitAngle) * r;
            const tLng = centreLng + Math.sin(sc.orbitAngle) * r * 1.3;
            flyTo(tLat, tLng, sc.cruiseSpeed);
            sc.workTicksLeft -= 1;
            if (sc.workTicksLeft <= 0) {
              completed.push({ droneId: d.id, missionId: mission.id, droneName: d.name, title: mission.title });
              byId.set(mission.id, { ...mission, status: "completed" });
              missionId = null;
              nextPhase = "return";
              targetLat = def.base.lat;
              targetLng = def.base.lng;
            }
          }
        } else if (phase === "onsite") {
          nextPhase = "landing";
        }

        // Nudge away from anything sharing the airspace at this altitude.
        for (const obs of initialObstacles) {
          const metres = distanceDeg(lat, lng, obs.lat, obs.lng) * 111000;
          if (metres < obs.radius + 120 && Math.abs(altitude - obs.altitude) < Math.max(obs.altitudeMax, 120)) {
            const away = bearing(obs.lat, obs.lng, lat, lng);
            const rad = (away * Math.PI) / 180;
            const push = stepFor(speed) * 0.9;
            lat += Math.cos(rad) * push;
            lng += Math.sin(rad) * push;
            heading = away;
          }
        }

        const battery = Math.max(0, d.battery - profile.drain - Math.random() * 0.03);

        // Break off and find a pod before it becomes a problem.
        if (battery < 25 && nextPhase !== "return" && nextPhase !== "landing") {
          if (mission && missionId != null) {
            byId.set(mission.id, { ...mission, status: "open", droneId: null });
          }
          nextPhase = "return";
          missionId = null;
          targetLat = def.base.lat;
          targetLng = def.base.lng;
          status = "emergency";
        }

        if (nextPhase !== "return" && nextPhase !== "landing") {
          status = missionId != null ? "mission" : "in-flight";
        }

        return {
          ...d,
          lat: clamp(lat, BOUNDS.minLat, BOUNDS.maxLat),
          lng: clamp(lng, BOUNDS.minLng, BOUNDS.maxLng),
          heading: Math.round(heading),
          altitude: Math.round(clamp(altitude, 0, 350)),
          speed: Math.round(speed),
          battery,
          status,
          phase: nextPhase,
          missionId,
          targetLat,
          targetLng,
        };
      });

      // Drop completed work off the board once it has been on screen a while.
      const merged = missions.map((m) => byId.get(m.id) ?? m);
      const settled = merged.filter((m) => m.status === "completed");
      const trimmed = settled.length > 8
        ? merged.filter((m) => m.status !== "completed" || settled.slice(-8).includes(m))
        : merged;

      setDrones(nextDrones);
      setLiveMissions(trimmed);
      completed.forEach((c) => emitMissionComplete(c.droneId, c.missionId, c.droneName, c.title));
    }, TICK_MS);

    return () => clearInterval(iv);
  }, [emitMissionComplete]);

  return { drones, liveMissions };
}

/* ─── Terminal Log Hook (Simülasyon Motoru) ─── */
export function useTerminalLogs(drones: DroneAgent[]) {
  const [logs, setLogs] = useState<
    { time: string; drone: string; level: string; msg: string }[]
  >([]);
  const simRef = useRef<FlightSimulator | null>(null);
  // Önceki durumları takip et — tekrar mesaj önlemek için
  const prevStateRef = useRef<Map<number, { battery: number; status: string; altitude: number }>>(new Map());
  const firedEventsRef = useRef<Set<string>>(new Set());

  // Simülatörü başlat
  useEffect(() => {
    simRef.current = new FlightSimulator(initialDrones);
    // İlk durumları kaydet
    initialDrones.forEach(d => {
      prevStateRef.current.set(d.id, { battery: d.battery, status: d.status, altitude: d.altitude });
    });
  }, []);

  // Drone durum DEĞİŞİKLİKLERİNİ izle — sadece geçiş anında BİR KERE log
  useEffect(() => {
    const now = new Date().toLocaleTimeString("tr-TR");
    const newLogs: { time: string; drone: string; level: string; msg: string }[] = [];

    drones.forEach((d) => {
      const prev = prevStateRef.current.get(d.id);
      if (!prev) {
        prevStateRef.current.set(d.id, { battery: d.battery, status: d.status, altitude: d.altitude });
        return;
      }

      const eventKey = `${d.id}-${d.status}-${Math.floor(d.battery / 5)}`; // 5% bantlarında deduplicate

      // Batarya %20'nin altına İLK KEZ düştü
      if (prev.battery >= 20 && d.battery < 20 && !firedEventsRef.current.has(`${d.id}-bat-critical`)) {
        firedEventsRef.current.add(`${d.id}-bat-critical`);
        newLogs.push({
          time: now, drone: d.name, level: "error",
          msg: `🚨 BATARYA KRİTİK! %${d.battery.toFixed(1)} — ${d.specs.model} acil iniş protokolü başlatıldı!`,
        });
      }

      // Status DEĞİŞTİ: emergency'e geçti (acil iniş başladı)
      if (prev.status !== "emergency" && d.status === "emergency") {
        newLogs.push({
          time: now, drone: d.name, level: "warning",
          msg: `⚠ ${d.specs.model} acil iniş başlatıldı. İrtifa: ${d.altitude}m → 0m`,
        });
      }

      // Status DEĞİŞTİ: charging'e geçti (iniş tamamlandı)
      if (prev.status !== "charging" && d.status === "charging") {
        firedEventsRef.current.delete(`${d.id}-bat-critical`); // sonraki uçuş için sıfırla
        newLogs.push({
          time: now, drone: d.name, level: "success",
          msg: `✅ İniş tamamlandı. ${d.specs.model} şarj poduna bağlandı.`,
        });

        // ═══ DRONE KOORDİNASYONU: Görevi başka drone'a devret ═══
        const mission = initialMissions.find(m => m.droneId === d.id && (m.status === "in-progress" || m.status === "accepted"));
        if (mission) {
          // En uygun boşta drone'u bul (yüksek batarya + uygun tip)
          const candidate = drones
            .filter(other => other.id !== d.id && other.battery > 40 && (other.status === "idle" || other.status === "in-flight"))
            .sort((a, b) => b.battery - a.battery)[0];

          if (candidate) {
            newLogs.push({
              time: now, drone: "FleetAgent", level: "system",
              msg: `🔄 KOORDİNASYON: "${mission.title}" görevi ${d.name}'dan ${candidate.name}'a devredildi (Batarya: %${candidate.battery.toFixed(0)})`,
            });
          } else {
            newLogs.push({
              time: now, drone: "FleetAgent", level: "warning",
              msg: `⚠ "${mission.title}" görevi askıda — uygun drone bulunamadı. Şarj tamamlanınca yeniden atanacak.`,
            });
          }
        }
      }

      // Status DEĞİŞTİ: charging → idle (şarj tamamlandı)
      if (prev.status === "charging" && d.status === "idle") {
        newLogs.push({
          time: now, drone: d.name, level: "success",
          msg: `🔋 Şarj tamamlandı! ${d.specs.batteryCapacity}mAh → %100. Görev bekleniyor.`,
        });
      }

      // Status DEĞİŞTİ: idle → in-flight (kalkış yaptı)
      if (prev.status === "idle" && d.status === "in-flight") {
        newLogs.push({
          time: now, drone: d.name, level: "info",
          msg: `[KALKIŞ] ${d.specs.manufacturer} ${d.specs.model} havalandı. Hedef irtifa: ${d.altitude}m`,
        });
      }

      // Durumu güncelle
      prevStateRef.current.set(d.id, { battery: d.battery, status: d.status, altitude: d.altitude });
    });

    if (newLogs.length > 0) {
      setLogs((prev) => [...prev.slice(-40), ...newLogs]);
    }
  }, [drones]);

  // Simülasyon motorundan CANLI mesajlar — her 1.5s'de sıradaki drone konuşur
  useEffect(() => {
    const iv = setInterval(() => {
      if (!simRef.current) return;
      const entry = simRef.current.getNextMessage(drones);
      const newLog = {
        time: entry.timestamp.toLocaleTimeString("tr-TR"),
        drone: entry.droneName,
        level: entry.level,
        msg: entry.msg,
      };
      setLogs((prev) => [...prev.slice(-60), newLog]);
    }, 1500);

    return () => clearInterval(iv);
  }, [drones]);

  // Görev tamamlama eventini dinle
  useEffect(() => {
    const handler = ((e: CustomEvent) => {
      const { droneName, missionTitle } = e.detail;
      const now = new Date().toLocaleTimeString("tr-TR");
      setLogs((prev) => [...prev.slice(-60), {
        time: now, drone: droneName, level: "success",
        msg: `🎯 GÖREV TAMAMLANDI! "${missionTitle}" başarıyla teslim edildi. ${droneName} iniş yaptı.`,
      }]);
    }) as EventListener;
    window.addEventListener("mission-complete", handler);
    return () => window.removeEventListener("mission-complete", handler);
  }, []);

  return logs;
}

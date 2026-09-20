/**
 * RiverAir — live fleet simulation engine
 * 
 * Her drone GERÇEK ZAMANLI verisini raporlar.
 * Mesajlar cache'lenmez — her çağrıda drone'un GÜNCEL durumuna göre üretilir.
 * Round-robin: 1→2→3→4→5→1→2→... Her drone sırayla konuşur.
 */

import { DroneAgent, initialMissions, Mission } from "./data";

export type LogLevel = "info" | "success" | "warning" | "error" | "system";

export interface SimLogEntry {
  droneId: number;
  droneName: string;
  level: LogLevel;
  msg: string;
  timestamp: Date;
}

// Her drone için mesaj şablonu tipi
type MsgTemplate = (drone: DroneAgent, mission: Mission | undefined) => string;

// ═══ MESAJ HAVUZU — Her drone tipi için farklı mesaj şablonları ═══
// Bu fonksiyonlar her çağrıda drone'un GÜNCEL değerlerini kullanır

const cargoTemplates: MsgTemplate[] = [
  (d, m) => `Altitude: ${d.altitude}m |Speed: ${d.speed}h |Heading: ${d.heading}° — cruise stable`,
  (d, m) => `Battery: %${d.battery.toFixed(1)} (${d.specs.batteryCapacity}mAh) |Remaining: ~${Math.floor(d.battery / 100 * d.specs.maxFlightTime)}dk`,
  (d, m) => `GPS: ${d.lat.toFixed(5)}°N, ${d.lng.toFixed(5)}°E | ${d.specs.sensors.includes("RTK GPS") ? "RTK FIX ±2cm" : "3D FIX"} ✓`,
  (d, m) => `${d.specs.model}motor temps: ${Math.floor(Math.random() * 8 + 42)}°C — nominal`,
  (d, m) => `ADS-B transponder active.Air traffic:clear ✓`,
  (d, m) => `scan:no obstacle.Route clear.`,
  (d, m) => m ? `Mission: "${m.title}" | Pay: ${m.payment} USDC | ${m.priority ? "PRIORITY 🔴" : "Normal"}` : `Idle. Listening for escrowed work.`,
  (d, m) => m ? `Dist to target: ~${calcRemaining(d, m).toFixed(1)}km | ETA: ${Math.max(1, Math.ceil(calcRemaining(d, m) / Math.max(d.speed, 1) * 60))}dk` : `No route. Standby.`,
  (d, m) => m ? `Mission progress: %${calcProgress(d, m)} complete` : `System idle.Sensors standby.`,
  (d, m) => m ? `Payload status:secure |Vibe: normal |Temp: ${Math.floor(Math.random() * 5 + 20)}°C` : `No payload.`,
  (d, m) => `Wind comp: +${(Math.random() * 3).toFixed(1)}° yaw düzeltmesi applied`,
  (d, m) => `Telemetry committed. TX: ${Math.random().toString(16).slice(2, 10)}`,
];

const emergencyTemplates: MsgTemplate[] = [
  (d, m) => `Altitude: ${d.altitude}m |Speed: ${d.speed}h | ${d.specs.model} operational`,
  (d, m) => `Battery: %${d.battery.toFixed(1)} (${d.specs.batteryCapacity}mAh) |Rem: ~${Math.floor(d.battery / 100 * d.specs.maxFlightTime)}dk`,
  (d, m) => m?.type === "fire" ? `🚨FIRE RESP: "${m.title}" | ${m.payment} USDC` : `Patrol active. Clear.`,
  (d, m) => `Thermal cam (${d.specs.sensors[0]}):scanning |Zone temp: ${Math.floor(Math.random() * 8 + 24)}°C`,
  (d, m) => m?.type === "fire" ? `detected: ${m.toLat.toFixed(4)}°N | Max: ${Math.floor(Math.random() * 150 + 280)}°C` : `Thermal anomaly:none ✓`,
  (d, m) => m?.type === "fire" ? `Fire area: ~${(Math.random() * 3 + 1.5).toFixed(1)}ha |Spread: ${["KB", "KD", "GB", "GD"][Math.floor(Math.random() * 4)]}` : `Sector scan: clear.`,
  (d, m) => m?.type === "fire" ? `Coords sent to fire dept ✓` : `Listening ATC.No distress call.`,
  (d, m) => `${d.specs.sensors[1]} zoom kamera: ${d.specs.sensors.includes("Zoom 48MP") ? "48MP optik, 200× hybrid" : "active"}`,
  (d, m) => m?.type === "fire" ? `Wind: ${Math.floor(Math.random() * 12 + 8)}s —spread risk ${Math.random() > 0.4 ? "HIGH" : "MEDIUM"}` : `Weather:clear for flight`,
  (d, m) => `Laser dist:target ${(Math.random() * 400 + 200).toFixed(0)}m |Speaker: standby`,
  (d, m) => `GPS: ${d.lat.toFixed(5)}°N, ${d.lng.toFixed(5)}°E | Spotlight: ${Math.random() > 0.5 ? "standby" : "active"}`,
  (d, m) => m ? `Mission prog: %${calcProgress(d, m)} | Coordinating` : `Guard pos.All sensors active.`,
];

const agriculturalTemplates: MsgTemplate[] = [
  (d, m) => `Altitude: ${d.altitude}m | Terrain Follow:ACTIVE |Speed: ${d.speed}km/h`,
  (d, m) => `Battery: %${d.battery.toFixed(1)} (${d.specs.batteryCapacity}mAh) |Rem: ~${Math.floor(d.battery / 100 * d.specs.maxFlightTime)}dk`,
  (d, m) => m ? `Op: "${m.title}" | ${m.payment} USDC` : `Waiting field scan.`,
  (d, m) => `Dual active |Flow: ${(Math.random() * 2 + 3).toFixed(1)}dk |Pressure: ${Math.floor(Math.random() * 5 + 45)}PSI`,
  (d, m) => `Tank level: %${Math.floor(Math.random() * 25 + 55)} |Rem: ~${Math.floor(Math.random() * 8 + 5)}L`,
  (d, m) => {
    const done = Math.floor(Math.random() * 10 + 12);
    return `Strip: ${done}/25 tamamlandı (%${Math.floor(done/25*100)}) |Spread:uniform ✓`;
  },
  (d, m) => `Phased Array Radar:terrain profile OK |Slope: ${(Math.random() * 6 + 2).toFixed(1)}°`,
  (d, m) => `position: ±2cm |Strip overlap: %${Math.floor(Math.random() * 3 + 8)} — optimal`,
  (d, m) => `Wind: ${Math.floor(Math.random() * 6 + 3)}s —for spray: ${Math.random() > 0.2 ? "ok ✓" : "⚠ sınırda / borderline"}`,
  (d, m) => m ? `Mission prog: %${calcProgress(d, m)} complete` : `Op pending.`,
  (d, m) => `GPS: ${d.lat.toFixed(5)}°N, ${d.lng.toFixed(5)}°E | ${d.specs.model} nominal`,
  (d, m) => `Telemetry: temp=${Math.floor(Math.random() * 5 + 28)}°C | humidity=%${Math.floor(Math.random() * 20 + 50)}`,
];

const idleTemplates: MsgTemplate[] = [
  (d) => `${d.specs.manufacturer} ${d.specs.model} ready.Battery: %${d.battery.toFixed(0)}`,
  (d) => `Listening escrow.Waiting new mission...`,
  (d) => `Sensors standby: ${d.specs.sensors.slice(0, 2).join(", ")} |Calibration: OK ✓`,
  (d) => `System check:all motors cool.Temp: ${Math.floor(Math.random() * 5 + 22)}°C`,
  (d) => `GPS: ${d.lat.toFixed(5)}°N, ${d.lng.toFixed(5)}°E |License: ${d.specs.license}valid ✓`,
  (d) => `Pos:on pad.Charge link: ${d.battery > 90 ? "done ✓" : "active"}`,
];

const chargingTemplates: MsgTemplate[] = [
  (d) => `Pod link active. ${d.specs.batteryCapacity}mAh → %${d.battery.toFixed(0)} charging...`,
  (d) => `Current: ${(d.specs.batteryCapacity / 1000 * 0.8).toFixed(1)}A |Voltage: nominal`,
  (d) => `Cell temp: ${Math.floor(Math.random() * 8 + 30)}°C —safe range`,
  (d) => `Charge ETA: ~${Math.max(1, Math.floor((95 - d.battery) / 100 * d.specs.chargeTime))}dk → %95 target`,
  (d) => `Balancing cells... ${d.specs.batteryCapacity}battery health: %98`,
];

// ═══ YARDIMCI HESAPLAMALAR ═══

function calcRemaining(drone: DroneAgent, mission: Mission): number {
  const dx = mission.toLat - drone.lat;
  const dy = mission.toLng - drone.lng;
  return Math.sqrt(dx * dx * 111 * 111 + dy * dy * 85 * 85);
}

function calcProgress(drone: DroneAgent, mission: Mission): number {
  const totalDist = Math.sqrt(
    Math.pow((mission.toLat - mission.fromLat) * 111, 2) +
    Math.pow((mission.toLng - mission.fromLng) * 85, 2)
  );
  const remaining = calcRemaining(drone, mission);
  const progress = Math.max(0, Math.min(99, Math.floor((1 - remaining / Math.max(totalDist, 0.1)) * 100)));
  return progress;
}

const surveillanceTemplates: MsgTemplate[] = [
  (d, m) => `Altitude: ${d.altitude}m |Speed: ${d.speed}h |Surveillance route active`,
  (d, m) => `Battery: %${d.battery.toFixed(1)} (${d.specs.batteryCapacity}mAh) |Rem: ~${Math.floor(d.battery / 100 * d.specs.maxFlightTime)}dk`,
  (d, m) => m ? `Monitor: "${m.title}" | ${m.payment} USDC` : `Patrol standby. Sensors ready.`,
  (d, m) => `cam:active |Stab: 3-eksen gimbal ✓ |Rec:in progress`,
  (d, m) => `ALPR: ${Math.random() > 0.5 ? "active —last det: 34ABC" + Math.floor(Math.random() * 100) : "standby"}`,
  (d, m) => m ? `Monitor area: ${m.fromLat.toFixed(4)}°N → ${m.toLat.toFixed(4)}°N |Coverage: optimal` : `Waiting area scan.`,
  (d, m) => `GPS: ${d.lat.toFixed(5)}°N, ${d.lng.toFixed(5)}°E | ${d.specs.model} nominal`,
  (d, m) => `Night vision: ${Math.random() > 0.5 ? "active (IR mod)" : "standby"} | Zoom: ${Math.floor(Math.random() * 20 + 10)}×`,
  (d, m) => `Traffic dens: ${["low", "medium", "high"][Math.floor(Math.random() * 3)]} |Vehicles: ${Math.floor(Math.random() * 80 + 20)}`,
  (d, m) => m ? `Mission prog: %${calcProgress(d, m)} complete` : `Op pending.`,
  (d, m) => `Telemetry stream: ${Math.floor(Math.random() * 30 + 10)} fps |Latency: ${Math.floor(Math.random() * 50 + 80)}ms`,
];

function getTemplatesForDrone(drone: DroneAgent): MsgTemplate[] {
  if (drone.status === "charging") return chargingTemplates;
  if (drone.status === "idle") return idleTemplates;

  switch (drone.type) {
    case "cargo": return cargoTemplates;
    case "emergency": return emergencyTemplates;
    case "agricultural": return agriculturalTemplates;
    case "surveillance": return surveillanceTemplates;
    default: return cargoTemplates;
  }
}

function detectLevel(msg: string): LogLevel {
  if (msg.includes("🚨") || msg.includes("KRİTİK") || msg.includes("YÜKSEK")) return "error";
  if (msg.includes("⚠") || msg.includes("DÜŞÜK") || msg.includes("sınırda")) return "warning";
  if (msg.includes("✅") || msg.includes("tamamlandı") || msg.includes("✓")) return "success";
  if (msg.includes("standby") || msg.includes("bekleniyor") || msg.includes("BEKLEME")) return "system";
  return "info";
}

// ═══ ANA SİMÜLASYON SINIFI ═══
export class FlightSimulator {
  private droneOrder: number[];
  private currentIndex = 0;
  private templateIndex: Map<number, number> = new Map(); // Her drone için şablon indexi

  constructor(drones: DroneAgent[]) {
    this.droneOrder = drones.map(d => d.id);
    // Her drone farklı bir şablondan başlasın
    drones.forEach((d, i) => this.templateIndex.set(d.id, i % 3));
  }

  /**
   * Her çağrıda sıradaki drone'dan CANLI mesaj üret.
   * Mesaj drone'un GÜNCEL verilerine göre oluşturulur (cache yok).
   */
  getNextMessage(drones: DroneAgent[]): SimLogEntry {
    // Round-robin: sıradaki drone
    const droneId = this.droneOrder[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.droneOrder.length;

    const drone = drones.find(d => d.id === droneId) || drones[0];
    const mission = initialMissions.find(m => m.id === drone.missionId);
    const templates = getTemplatesForDrone(drone);

    // Bu drone'un sıradaki şablonunu al
    const idx = this.templateIndex.get(drone.id) || 0;
    const template = templates[idx % templates.length];
    this.templateIndex.set(drone.id, idx + 1);

    // CANLI mesaj üret (güncel drone verileriyle)
    const msg = template(drone, mission);

    return {
      droneId: drone.id,
      droneName: drone.name,
      level: detectLevel(msg),
      msg,
      timestamp: new Date(),
    };
  }
}

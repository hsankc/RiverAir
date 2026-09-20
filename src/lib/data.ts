// Seed fleet and mission data for the İstanbul demo region.
import { FLEET, toAgent } from "@/lib/fleet";
export type DroneStatus = "idle" | "in-flight" | "charging" | "emergency" | "mission";

/**
 * Where an aircraft is in its flight, as distinct from what it is doing.
 * `cruise` is the leg out to the pickup; `onsite` is the work itself, which
 * differs by aircraft type — a delivery leg, a spraying sweep, or an orbit.
 */
export type FlightPhase =
  | "grounded"
  | "takeoff"
  | "cruise"
  | "onsite"
  | "return"
  | "landing";
export type DroneType = "cargo" | "agricultural" | "surveillance" | "emergency";
export type MissionType = "cargo" | "agricultural" | "fire" | "traffic";

export interface DroneSpecs {
  model: string;           // Real manufacturer model name
  manufacturer: string;    // Manufacturer
  maxSpeed: number;        // km/h — from manufacturer specs
  maxAltitude: number;     // meters — legal/technical max
  batteryCapacity: number; // mAh
  weightEmpty: number;     // grams — empty weight (not MTOW)
  maxPayload: number;      // grams — max carryable payload
  maxFlightTime: number;   // minutes — ideal unloaded flight
  chargeTime: number;      // minutes — 0→100% charging
  pricePerKm: number;      // USDC — mission rate per km
  license: string;         // Flight authority category
  sensors: string[];       // Sensor hardware
}

export interface DroneAgent {
  id: number;
  name: string;
  type: DroneType;
  lat: number;
  lng: number;
  altitude: number;
  battery: number;
  speed: number; // km/h
  heading: number; // degrees
  status: DroneStatus;
  reputation: number;
  missionId: number | null;
  personality: string;
  specs: DroneSpecs;
  targetLat?: number;
  targetLng?: number;
  /** Set by the simulation; seed data starts grounded. */
  phase?: FlightPhase;
}

export interface ChargingPod {
  id: number;
  name: string;
  owner: string;
  lat: number;
  lng: number;
  rate: number; // USDC per kWh
  available: boolean;
  totalEnergy: number; // kWh supplied
  totalEarned: number; // USDC earned
  activeSessions: number;
}

export interface Mission {
  id: number;
  type: MissionType;
  title: string;
  description: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  payment: number; // USDC, 7dp
  status: "open" | "accepted" | "in-progress" | "completed" | "cancelled";
  droneId: number | null;
  createdAt: Date;
  priority: boolean;
}

export interface FlightLog {
  id: number;
  droneId: string;
  droneName: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  duration: number; // minutes
  energyUsed: number; // kWh
  missionType: MissionType;
  txHash: string;
  timestamp: Date;
}

// ═══════════════════════════════════════════════════════════
// THE FLEET
// Two aircraft per discipline — a heavy and a light — spread across opposite
// sides of the city. Each is defined in its own file under `src/lib/fleet/`
// (base, accepted work, flight envelope and duties) and the roster is
// assembled from those definitions rather than written out here.
// ═══════════════════════════════════════════════════════════
export const initialDrones: DroneAgent[] = FLEET.map(toAgent);

// ── CHARGING PODS ──
export const initialPods: ChargingPod[] = [
  // One pad per aircraft. Each launches from and returns to its own — the pad
  // coordinates here are the same `base` the fleet definitions declare.
  { id: 1, name: "Kadıköy Hub", owner: "GA7F3K…QB8ED", lat: 40.9900, lng: 29.0270, rate: 0.05, available: true, totalEnergy: 1250, totalEarned: 62.5, activeSessions: 0 },
  { id: 2, name: "Silivri Agro Station", owner: "GD9E3M…RC7B2", lat: 41.0730, lng: 28.2460, rate: 0.055, available: true, totalEnergy: 1540, totalEarned: 84.7, activeSessions: 0 },
  { id: 3, name: "Levent Deck", owner: "GC5B2T…VA3F1", lat: 41.0820, lng: 29.0100, rate: 0.06, available: true, totalEnergy: 2100, totalEarned: 126, activeSessions: 0 },
  { id: 4, name: "Belgrad Forest Station", owner: "GE8D4W…XB9C3", lat: 41.1900, lng: 28.9500, rate: 0.058, available: true, totalEnergy: 1680, totalEarned: 97.4, activeSessions: 0 },
  { id: 5, name: "Bakırköy Sahil", owner: "GA3F7N…YD2E8", lat: 40.9800, lng: 28.8720, rate: 0.05, available: true, totalEnergy: 620, totalEarned: 31, activeSessions: 0 },
  { id: 6, name: "Çatalca Field Station", owner: "GF2A8H…WC4D6", lat: 41.1430, lng: 28.4610, rate: 0.052, available: true, totalEnergy: 740, totalEarned: 38.5, activeSessions: 0 },
  { id: 7, name: "Ataşehir Deck", owner: "GB4C9P…ZE1A7", lat: 40.9920, lng: 29.1270, rate: 0.062, available: true, totalEnergy: 980, totalEarned: 56.8, activeSessions: 0 },
  { id: 8, name: "Aydos Forest Post", owner: "GH6E1R…UB5F9", lat: 41.0000, lng: 29.2300, rate: 0.057, available: true, totalEnergy: 830, totalEarned: 47.3, activeSessions: 0 },
];

// ── MISSIONS ──
export const initialMissions: Mission[] = [
  { id: 1, type: "cargo", title: "Kadıköy → Beşiktaş package", description: "3.2 kg parcel across the Bosphorus", fromLat: 40.9900, fromLng: 29.0270, toLat: 41.0430, toLng: 29.0080, payment: 2.5, status: "open", droneId: null, createdAt: new Date(), priority: false },
  { id: 2, type: "agricultural", title: "Silivri sunflower spraying", description: "Pest control pass over an 18 ha sunflower plot", fromLat: 41.0700, fromLng: 28.2400, toLat: 41.0736, toLng: 28.2448, payment: 8.5, status: "open", droneId: null, createdAt: new Date(), priority: false },
  { id: 3, type: "traffic", title: "Levent junction analysis", description: "Turning-movement counts at the Levent interchange", fromLat: 41.0800, fromLng: 29.0080, toLat: 41.0870, toLng: 29.0190, payment: 5.9, status: "open", droneId: null, createdAt: new Date(), priority: false },
  { id: 4, type: "fire", title: "Belgrad Forest thermal sweep", description: "Hot-spot scan along the northern treeline after a dry spell", fromLat: 41.1900, fromLng: 28.9500, toLat: 41.2060, toLng: 28.9300, payment: 15, status: "open", droneId: null, createdAt: new Date(), priority: true },
];

// ── FLIGHT LOGS ──
export const initialFlightLogs: FlightLog[] = [
  { id: 1, droneId: "1", droneName: "Kadikoy-01", startLat: 40.9900, startLng: 29.0270, endLat: 41.0430, endLng: 29.0080, duration: 12, energyUsed: 8.5, missionType: "cargo", txHash: "a3f91c…7d2e04", timestamp: new Date(Date.now() - 3600000) },
  { id: 2, droneId: "4", droneName: "Belgrad-02", startLat: 41.1900, startLng: 28.9500, endLat: 41.2060, endLng: 28.9300, duration: 15, energyUsed: 12.1, missionType: "fire", txHash: "b7c42e…1f9a36", timestamp: new Date(Date.now() - 7200000) },
  { id: 3, droneId: "2", droneName: "Silivri-03", startLat: 41.0730, startLng: 28.2460, endLat: 41.0736, endLng: 28.2448, duration: 45, energyUsed: 18.7, missionType: "agricultural", txHash: "c1d83f…4b6e17", timestamp: new Date(Date.now() - 10800000) },
  { id: 4, droneId: "3", droneName: "Levent-12", startLat: 41.0820, startLng: 29.0100, endLat: 41.0870, endLng: 29.0190, duration: 25, energyUsed: 15.6, missionType: "traffic", txHash: "e4a76b…9d3105", timestamp: new Date(Date.now() - 18000000) },
];

// ── agentMessages — legacy, simulation.ts engine is now used ──
export const agentMessages: { droneId: number; level: "info" | "success" | "warning" | "error"; msg: string }[] = [];

// ── Util: Generate a random TX hash ──
export function randomTxHash(): string {
  const chars = "0123456789abcdef";
  let h = "0x";
  for (let i = 0; i < 8; i++) h += chars[Math.floor(Math.random() * 16)];
  h += "...";
  for (let i = 0; i < 4; i++) h += chars[Math.floor(Math.random() * 16)];
  return h;
}

export const droneTypeLabels = (locale: string = "en"): Record<DroneType, string> => ({
  cargo: "Cargo",
  agricultural: "Agriculture",
  surveillance: "Surveillance",
  emergency: "Emergency",
});

export const missionTypeLabels = (locale: string = "en"): Record<MissionType, string> => ({
  cargo: "Cargo Delivery",
  agricultural: "Agriculture Op",
  fire: "Fire Response",
  traffic: "Traffic Monitor",
});

export const statusLabels = (locale: string = "en"): Record<DroneStatus, string> => ({
  idle: "Standby",
  "in-flight": "In Flight",
  charging: "Charging",
  emergency: "Emergency",
  mission: "On Mission",
});

export const missionStatusLabels = (locale: string = "en"): Record<string, string> => ({
  open: "Open",
  accepted: "Accepted",
  "in-progress": "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
});

// ═══ AIRSPACE OBSTACLES ═══
export type ObstacleType = "bird_flock" | "balloon" | "drone_traffic" | "no_fly_zone" | "weather" | "paraglider";

export interface AirspaceObstacle {
  id: number;
  type: ObstacleType;
  name: string;
  lat: number;
  lng: number;
  radius: number;      // meters — area of effect radius
  altitude: number;    // meters
  altitudeMax: number;  // meters — max altitude
  severity: "low" | "medium" | "high";
  moving: boolean;     // is it moving
  speedKmh: number;    // movement speed
  heading: number;     // movement heading
  description: string;
  detectedBy?: number; // id of detecting drone
}

export const obstacleTypeLabels: Record<ObstacleType, string> = {
  bird_flock: "Bird Flock",
  balloon: "Hot Air Balloon",
  drone_traffic: "Drone Traffic",
  no_fly_zone: "No Fly Zone",
  weather: "Severe Weather",
  paraglider: "Paraglider",
};

export const obstacleIcons: Record<ObstacleType, string> = {
  bird_flock: "🐦",
  balloon: "🎈",
  drone_traffic: "🛸",
  no_fly_zone: "🚫",
  weather: "⛈️",
  paraglider: "🪂",
};

export const initialObstacles: AirspaceObstacle[] = [
  {
    id: 101, type: "bird_flock", name: "Gull Colony",
    lat: 41.0180, lng: 28.9720, radius: 300, altitude: 60, altitudeMax: 180,
    severity: "medium", moving: true, speedKmh: 22, heading: 180,
    description: "Dense gull population over the Golden Horn. Crosses the strait at dusk.",
  },
  {
    id: 102, type: "balloon", name: "Advertising Balloon",
    lat: 41.0540, lng: 28.9880, radius: 50, altitude: 150, altitudeMax: 200,
    severity: "low", moving: false, speedKmh: 0, heading: 0,
    description: "Tethered balloon over Şişli. Fixed position, marked on charts.",
  },
  {
    id: 103, type: "drone_traffic", name: "Unknown Drone",
    lat: 41.0850, lng: 29.0150, radius: 100, altitude: 120, altitudeMax: 150,
    severity: "medium", moving: true, speedKmh: 40, heading: 90,
    description: "Unregistered aircraft over Levent — no IFF response.",
  },
  {
    id: 104, type: "no_fly_zone", name: "Airport Approach",
    lat: 41.2753, lng: 28.7519, radius: 2500, altitude: 0, altitudeMax: 5000,
    severity: "high", moving: false, speedKmh: 0, heading: 0,
    description: "İstanbul Airport approach corridor — permanent exclusion zone.",
  },
  {
    id: 105, type: "no_fly_zone", name: "Airport Approach (Asia)",
    lat: 40.8980, lng: 29.3092, radius: 1800, altitude: 0, altitudeMax: 4000,
    severity: "high", moving: false, speedKmh: 0, heading: 0,
    description: "Sabiha Gökçen approach corridor — permanent exclusion zone.",
  },
  {
    id: 106, type: "weather", name: "Poyraz Wind",
    lat: 41.1400, lng: 29.1200, radius: 600, altitude: 0, altitudeMax: 300,
    severity: "medium", moving: true, speedKmh: 18, heading: 225,
    description: "North-easterly over the upper Bosphorus, gusting past 45 km/h.",
  },
  {
    id: 107, type: "bird_flock", name: "Stork Migration",
    lat: 41.1700, lng: 28.8200, radius: 400, altitude: 200, altitudeMax: 600,
    severity: "medium", moving: true, speedKmh: 30, heading: 200,
    description: "Seasonal stork corridor crossing the northern forest belt.",
  },
  {
    id: 108, type: "paraglider", name: "Paraglider",
    lat: 40.8600, lng: 29.1250, radius: 200, altitude: 200, altitudeMax: 600,
    severity: "low", moving: true, speedKmh: 28, heading: 150,
    description: "Paraglider activity reported off the Princes' Islands.",
  },
];

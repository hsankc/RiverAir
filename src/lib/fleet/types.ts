import type { DroneAgent, DroneSpecs, DroneType, MissionType } from "@/lib/data";

/**
 * Where an aircraft lives. It takes off from here and comes back here — not to
 * whichever pad happens to be nearest — so every flight has a fixed, readable
 * start and end.
 */
export interface HomeBase {
  name: string;
  lat: number;
  lng: number;
  /** What the pad actually is, in a few words. */
  kind: string;
}

/** The envelope the aircraft flies in. Real units; the clock is what's scaled. */
export interface FlightEnvelope {
  /**
   * Metres AGL, picked per sortie from this range. SHT-İHA caps standard
   * commercial operations at 120 m, so no airframe here is given a ceiling
   * above it — the fleet flies the envelope its licence class allows.
   */
  cruiseAltitude: [number, number];
  /** km/h, picked per sortie from this range. */
  cruiseSpeed: [number, number];
  /** Metres gained or lost per tick. */
  climbRate: number;
  /** Battery percent per tick in level flight. */
  drainPerTick: number;
}

/** How the aircraft works a site once it has arrived. */
export type OnSiteBehaviour =
  /** Carry the load from pickup to drop-off. */
  | "deliver"
  /** Crawl a lawnmower pattern across the plot. */
  | "sweep"
  /** Circle the site while the survey runs. */
  | "orbit"
  /** Sit over the site and watch. */
  | "hold";

/**
 * One aircraft, described in one place: who it is, where it lives, what work it
 * accepts, and how it flies. The simulation reads this and nothing else.
 */
export interface DroneDefinition {
  id: number;
  name: string;
  callsign: string;
  type: DroneType;
  base: HomeBase;
  /** Mission types this airframe will accept. */
  accepts: MissionType[];
  onSite: OnSiteBehaviour;
  /** Orbit radius in degrees, for the types that circle. */
  orbitRadius: number;
  /** Ticks spent working a site, for orbit and hold. */
  onSiteTicks: number;
  envelope: FlightEnvelope;
  specs: DroneSpecs;
  /** What this aircraft is for, in a sentence. */
  brief: string;
  /** The concrete jobs it runs. */
  duties: string[];
  startBattery: number;
  reputation: number;
}

/** Build the runtime agent the simulation and the UI work with. */
export function toAgent(def: DroneDefinition): DroneAgent {
  return {
    id: def.id,
    name: def.name,
    type: def.type,
    lat: def.base.lat,
    lng: def.base.lng,
    altitude: 0,
    battery: def.startBattery,
    speed: 0,
    heading: 0,
    status: "idle",
    reputation: def.reputation,
    missionId: null,
    personality: def.brief,
    specs: def.specs,
    phase: "grounded",
  };
}

import type { DroneDefinition } from "./types";

/**
 * LEVENT-12 — the observer.
 *
 * Flies out of the Levent business district and surveys traffic. It has nothing
 * to carry and nowhere to land at the far end, so its work is a circle: it
 * arrives over a junction, orbits it while the count runs, and comes home.
 */
export const leventWatch: DroneDefinition = {
  id: 3,
  name: "Levent-12",
  callsign: "OBSERVER",
  type: "surveillance",

  base: {
    name: "Levent Deck",
    lat: 41.082,
    lng: 29.01,
    kind: "Tower deck, business district",
  },

  accepts: ["traffic"],
  onSite: "orbit",
  // Wide enough to keep a whole junction in frame.
  orbitRadius: 0.006,
  onSiteTicks: 20,

  // High enough to see a junction end to end and to stay clear of the towers.
  envelope: {
    cruiseAltitude: [150, 190],
    cruiseSpeed: [38, 50],
    climbRate: 12,
    drainPerTick: 0.08,
  },

  specs: {
    model: "Matrice 30T",
    manufacturer: "DJI",
    maxSpeed: 82,
    maxAltitude: 7000,
    batteryCapacity: 3850,
    weightEmpty: 3770,
    maxPayload: 230,
    maxFlightTime: 41,
    chargeTime: 35,
    pricePerKm: 0.15,
    license: "SHT-İHA2",
    sensors: ["Thermal 640×512", "48 MP zoom", "Laser rangefinder", "Spotlight"],
  },

  brief:
    "Traffic observer for the Levent corridor and the bridge approaches. Orbits a junction at 170 m while it counts flow, queues and turning movements.",

  duties: [
    "Transit to the junction and establish an orbit",
    "Circle for the length of the survey window",
    "Count flow, queue length and turning movements",
    "Break off and return to the Levent deck",
  ],

  startBattery: 95,
  reputation: 93,
};

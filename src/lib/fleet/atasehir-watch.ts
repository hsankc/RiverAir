import type { DroneDefinition } from "./types";

/**
 * ATASEHIR-09 — the compact observer.
 *
 * Levent-12 watches the corridor; this one works the Anatolian-side junctions,
 * where the surveys are shorter and the aircraft has to sit lower and closer to
 * read plates and lane discipline. A much smaller airframe, so it can hold a
 * tight orbit over a single intersection instead of a whole interchange.
 */
export const atasehirWatch: DroneDefinition = {
  id: 7,
  name: "Atasehir-09",
  callsign: "KESTREL",
  type: "surveillance",

  base: {
    name: "Ataşehir Deck",
    lat: 40.992,
    lng: 29.127,
    kind: "Rooftop deck, Anatolian side",
  },

  accepts: ["traffic"],
  onSite: "orbit",
  // Tighter than Levent-12: one intersection, not a whole interchange.
  orbitRadius: 0.004,
  onSiteTicks: 16,

  // Lower and quicker than the Matrice — short hops between junctions.
  envelope: {
    cruiseAltitude: [120, 155],
    cruiseSpeed: [46, 62],
    climbRate: 13,
    drainPerTick: 0.06,
  },

  specs: {
    model: "Mavic 3 Enterprise",
    manufacturer: "DJI",
    maxSpeed: 75,
    maxAltitude: 6000,
    batteryCapacity: 5000,
    weightEmpty: 920,
    maxPayload: 0,
    maxFlightTime: 45,
    chargeTime: 60,
    pricePerKm: 0.11,
    license: "SHT-İHA1",
    sensors: ["56× zoom", "Thermal 640×512", "RTK", "Speaker", "Spotlight"],
  },

  brief:
    "Junction observer for the Anatolian side. Small enough to hold a tight orbit over a single intersection at 140 m and read lane discipline rather than just flow.",

  duties: [
    "Hop to the junction from the Ataşehir deck",
    "Hold a tight orbit directly over the intersection",
    "Record lane occupancy, signal timing and turning conflicts",
    "Break off and return before the battery reserve is touched",
  ],

  startBattery: 93,
  reputation: 90,
};

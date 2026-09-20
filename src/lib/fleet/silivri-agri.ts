import type { DroneDefinition } from "./types";

/**
 * SILIVRI-03 — the sprayer.
 *
 * Works the farmland on the western edge of the city, a long way from everyone
 * else. It does not fly point to point: it flies to a plot and then crawls a
 * lawnmower pattern across it, low and slow, treating the ground row by row.
 */
export const silivriAgri: DroneDefinition = {
  id: 2,
  name: "Silivri-03",
  callsign: "SPRAYER",
  type: "agricultural",

  base: {
    name: "Silivri Agro Station",
    lat: 41.073,
    lng: 28.246,
    kind: "Field station, western farmland",
  },

  accepts: ["agricultural"],
  onSite: "sweep",
  orbitRadius: 0,
  onSiteTicks: 0,

  // Spray height. Any higher and the chemical drifts; any faster and the
  // coverage goes patchy.
  envelope: {
    cruiseAltitude: [3, 6],
    cruiseSpeed: [14, 22],
    climbRate: 2,
    drainPerTick: 0.13,
  },

  specs: {
    model: "Agras T40",
    manufacturer: "DJI",
    maxSpeed: 54,
    maxAltitude: 3000,
    batteryCapacity: 30000,
    weightEmpty: 28500,
    maxPayload: 50000,
    maxFlightTime: 21,
    chargeTime: 12,
    pricePerKm: 0.25,
    license: "SHT-İHA2",
    sensors: ["Phased array radar", "Dual atomiser", "Terrain follow", "RTK"],
  },

  brief:
    "Field sprayer for the Silivri and Çatalca farmland. Treats a marked plot on a lawnmower pattern — spraying, irrigating or surveying, depending on the job.",

  duties: [
    "Fly to the plot and enter at its nearest corner",
    "Crawl the field in five passes, treating as it goes",
    "Hold 30 m so the spray lands where it should",
    "Return to the Silivri station once the last row is done",
  ],

  startBattery: 88,
  reputation: 90,
};

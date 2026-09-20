import type { DroneDefinition } from "./types";

/**
 * CATALCA-07 — the second sprayer.
 *
 * A smaller tank than Silivri-03 and a tighter turn, which suits the broken-up
 * plots around Çatalca and Arnavutköy. It flies the same lawnmower pattern but
 * lower and slower, so it can work fields with hedgerows and power lines
 * running through them.
 */
export const catalcaAgri: DroneDefinition = {
  id: 6,
  name: "Catalca-07",
  callsign: "HARROW",
  type: "agricultural",

  base: {
    name: "Çatalca Field Station",
    lat: 41.143,
    lng: 28.461,
    kind: "Field station, northern plains",
  },

  accepts: ["agricultural"],
  onSite: "sweep",
  orbitRadius: 0,
  onSiteTicks: 0,

  // Lower and slower than the T40 — smaller plots, more obstacles to clear.
  envelope: {
    cruiseAltitude: [22, 34],
    cruiseSpeed: [15, 22],
    climbRate: 5,
    drainPerTick: 0.14,
  },

  specs: {
    model: "Agras T25",
    manufacturer: "DJI",
    maxSpeed: 46,
    maxAltitude: 3000,
    batteryCapacity: 24000,
    weightEmpty: 21500,
    maxPayload: 25000,
    maxFlightTime: 17,
    chargeTime: 10,
    pricePerKm: 0.22,
    license: "SHT-İHA2",
    sensors: ["Phased array radar", "Centrifugal atomiser", "Terrain follow", "RTK"],
  },

  brief:
    "Smaller sprayer for the broken plots around Çatalca and Arnavutköy. Works lower and slower than the T40, which is what fields with hedgerows and overhead lines need.",

  duties: [
    "Fly to the plot and enter at the corner nearest the station",
    "Sweep the field at 28 m, following the terrain as it goes",
    "Treat, irrigate or survey depending on what the job asked for",
    "Return to the Çatalca station to refill and recharge",
  ],

  startBattery: 90,
  reputation: 88,
};

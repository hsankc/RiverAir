import type { DroneDefinition } from "./types";

/**
 * BELGRAD-02 — the responder.
 *
 * Sits at the forest station north of the city and launches at whatever is
 * burning or missing. It climbs higher and flies harder than anything else in
 * the fleet, then holds a tight pattern over the site feeding thermal back.
 */
export const belgradFire: DroneDefinition = {
  id: 4,
  name: "Belgrad-02",
  callsign: "RESPONDER",
  type: "emergency",

  base: {
    name: "Belgrad Forest Station",
    lat: 41.19,
    lng: 28.95,
    kind: "Forestry station, northern treeline",
  },

  accepts: ["fire"],
  onSite: "hold",
  // Tight, so the thermal stays on the hot spot.
  orbitRadius: 0.0035,
  onSiteTicks: 14,

  // Above the smoke column, fast enough that the first look is worth having.
  envelope: {
    cruiseAltitude: [95, 118],
    cruiseSpeed: [62, 76],
    climbRate: 15,
    drainPerTick: 0.16,
  },

  specs: {
    model: "Matrice 350 RTK",
    manufacturer: "DJI",
    maxSpeed: 82,
    maxAltitude: 7000,
    batteryCapacity: 5880,
    weightEmpty: 6470,
    maxPayload: 2700,
    maxFlightTime: 55,
    chargeTime: 52,
    pricePerKm: 0.12,
    license: "SHT-İHA2",
    sensors: ["Thermal H30T", "RTK GPS", "CSM radar", "ADS-B", "Spotlight"],
  },

  brief:
    "Fire and search response out of the Belgrad Forest station. First aircraft over a reported fire, holding above the smoke and streaming thermal to the ground crew.",

  duties: [
    "Launch on a fire or distress report and transit at best speed",
    "Climb above the smoke column before arriving overhead",
    "Hold over the site and stream thermal while the crew moves in",
    "Return to the forestry station and recharge for the next call",
  ],

  startBattery: 98,
  reputation: 99,
};

import type { DroneDefinition } from "./types";

/**
 * AYDOS-11 — the Anatolian-side responder.
 *
 * Belgrad-02 covers the northern forest; this one covers Aydos and the Kocaeli
 * approach. It is a far lighter airframe than the Matrice 350, which is the
 * point: it gets airborne and on-scene quickly, holds a thermal picture, and
 * hands off to the heavy aircraft if the incident grows.
 */
export const aydosFire: DroneDefinition = {
  id: 8,
  name: "Aydos-11",
  callsign: "EMBER",
  type: "emergency",

  base: {
    name: "Aydos Forest Post",
    lat: 41.0,
    lng: 29.23,
    kind: "Ranger post, eastern forest",
  },

  accepts: ["fire"],
  onSite: "hold",
  // Sits close in — the thermal needs the detail, not the coverage.
  orbitRadius: 0.0025,
  onSiteTicks: 12,

  // Climbs fast and gets there fast; it is the first aircraft over an incident.
  envelope: {
    cruiseAltitude: [160, 205],
    cruiseSpeed: [56, 72],
    climbRate: 15,
    drainPerTick: 0.11,
  },

  specs: {
    model: "EVO II Dual 640T V3",
    manufacturer: "Autel Robotics",
    maxSpeed: 72,
    maxAltitude: 7000,
    batteryCapacity: 7100,
    weightEmpty: 1350,
    maxPayload: 0,
    maxFlightTime: 42,
    chargeTime: 55,
    pricePerKm: 0.14,
    license: "SHT-İHA1",
    sensors: ["Thermal 640×512", "8K camera", "PDAF", "360° obstacle avoidance"],
  },

  brief:
    "First responder for Aydos and the eastern forest. Light, quick off the pad, and holds a close thermal picture over the seat of a fire until the heavy aircraft arrives.",

  duties: [
    "Launch on the alert and climb straight out of the ranger post",
    "Run direct to the reported coordinates",
    "Hold close over the seat of the fire and stream thermal",
    "Pass the picture to ground crews, then return to Aydos",
  ],

  startBattery: 97,
  reputation: 94,
};

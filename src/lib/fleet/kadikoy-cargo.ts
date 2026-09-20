import type { DroneDefinition } from "./types";

/**
 * KADIKOY-01 — the courier.
 *
 * Lives on the roof pad at the Kadıköy ferry terminal and runs parcels across
 * the city. It is the only aircraft in the fleet that carries a load, so it is
 * the only one whose flight has two distinct legs: out to the sender empty,
 * then across to the recipient with the parcel aboard.
 */
export const kadikoyCargo: DroneDefinition = {
  id: 1,
  name: "Kadikoy-01",
  callsign: "COURIER",
  type: "cargo",

  base: {
    name: "Kadıköy Hub",
    lat: 40.99,
    lng: 29.027,
    kind: "Rooftop pad, ferry terminal",
  },

  accepts: ["cargo"],
  onSite: "deliver",
  orbitRadius: 0,
  onSiteTicks: 0,

  // Above the rooftops, below the helicopter lanes, fast enough that a
  // cross-Bosphorus parcel beats the traffic.
  envelope: {
    cruiseAltitude: [110, 150],
    cruiseSpeed: [55, 70],
    climbRate: 14,
    drainPerTick: 0.1,
  },

  specs: {
    model: "FlyCart 30",
    manufacturer: "DJI",
    maxSpeed: 67,
    maxAltitude: 6000,
    batteryCapacity: 17668,
    weightEmpty: 42000,
    maxPayload: 30000,
    maxFlightTime: 18,
    chargeTime: 25,
    pricePerKm: 0.35,
    license: "SHT-İHA2",
    sensors: ["RTK GPS", "360° obstacle sensing", "ADS-B", "Parachute"],
  },

  brief:
    "Cross-city courier working out of Kadıköy. Collects from the sender, carries the parcel over the Bosphorus, and puts it down at the recipient.",

  duties: [
    "Fly empty to the pickup address and confirm the parcel",
    "Carry up to 30 kg to the delivery address",
    "Hand off, then return to the Kadıköy pad",
    "Refuse the job if the escrow price feed is stale on arrival",
  ],

  startBattery: 92,
  reputation: 94,
};

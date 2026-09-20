import type { DroneDefinition } from "./types";

/**
 * BAKIRKOY-05 — the long-range courier.
 *
 * The European-side counterpart to Kadikoy-01, and a different aircraft for a
 * different job: a fixed-wing VTOL that takes off vertically and then flies on
 * a wing. It is the one that gets the runs out to Silivri and Çatalca, where a
 * multirotor would spend its whole battery on the transit.
 */
export const bakirkoyCargo: DroneDefinition = {
  id: 5,
  name: "Bakirkoy-05",
  callsign: "ALBATROSS",
  type: "cargo",

  base: {
    name: "Bakırköy Sahil",
    lat: 40.98,
    lng: 28.872,
    kind: "Coastal pad, European side",
  },

  accepts: ["cargo"],
  onSite: "deliver",
  orbitRadius: 0,
  onSiteTicks: 0,

  // Fixed-wing cruise: higher and considerably faster than a multirotor, and
  // it sips battery once it is up on the wing.
  envelope: {
    cruiseAltitude: [150, 195],
    cruiseSpeed: [78, 96],
    climbRate: 16,
    drainPerTick: 0.07,
  },

  specs: {
    model: "Dragonfish Standard",
    manufacturer: "Autel Robotics",
    maxSpeed: 108,
    maxAltitude: 5000,
    batteryCapacity: 9800,
    weightEmpty: 7500,
    maxPayload: 1000,
    maxFlightTime: 158,
    chargeTime: 70,
    pricePerKm: 0.1,
    license: "SHT-İHA2",
    sensors: ["50 MP wide", "640 zoom", "Thermal", "VTOL hybrid", "ADS-B"],
  },

  brief:
    "Long-range courier on the European side. VTOL takeoff, then fixed-wing cruise — it takes the runs out to the western districts that a multirotor cannot reach and return from.",

  duties: [
    "Lift vertically off the Bakırköy pad, then transition to wing-borne flight",
    "Run parcels out to Silivri, Çatalca and the western edge",
    "Descend vertically at the delivery address",
    "Return to Bakırköy and hand the pad back",
  ],

  startBattery: 96,
  reputation: 91,
};

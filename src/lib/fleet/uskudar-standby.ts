import type { DroneDefinition } from "./types";

/**
 * USKUDAR-04 — the standby courier.
 *
 * The other eight aircraft are always busy, because the demo board always has
 * work on it. That is fine until a customer funds a real mission and watches it
 * sit open while the fleet finishes a queue of missions nobody paid for.
 *
 * This airframe exists so that never happens. It is marked `standby`, which
 * means it ignores the demo board entirely and only ever flies work that came
 * out of the escrow contract. Most of the time it sits on its pad doing
 * nothing, which is exactly the point — a courier that is always available is
 * worth more than one that is always flying.
 *
 * It lives at Üsküdar, between the two banks and roughly midway along the
 * Kadıköy–Beşiktaş run, so whatever gets posted it is already close.
 */
export const uskudarStandby: DroneDefinition = {
  id: 9,
  name: "Uskudar-04",
  callsign: "STANDBY",
  type: "cargo",

  base: {
    name: "Üsküdar Standby Pad",
    lat: 41.0255,
    lng: 29.0152,
    kind: "Waterfront pad, reserved for paid work",
  },

  accepts: ["cargo"],
  standby: true,
  onSite: "deliver",
  orbitRadius: 0,
  onSiteTicks: 0,

  // A heavy-lift multirotor rather than a VTOL: it launches from a standing
  // start with no runway and no transition, which is what being on call needs.
  envelope: {
    cruiseAltitude: [75, 100],
    cruiseSpeed: [58, 74],
    climbRate: 13,
    drainPerTick: 0.09,
  },

  specs: {
    model: "Alta X",
    manufacturer: "Freefly",
    maxSpeed: 90,
    maxAltitude: 4500,
    batteryCapacity: 32000,
    weightEmpty: 18100,
    maxPayload: 15900,
    maxFlightTime: 50,
    chargeTime: 40,
    pricePerKm: 0.32,
    license: "SHT-İHA2",
    sensors: ["RTK GPS", "Redundant IMU", "ADS-B", "Downward lidar"],
  },

  brief:
    "Standby courier on the Üsküdar waterfront. Flies nothing off the public board — it is held for missions funded through the escrow, so paid work never waits.",

  duties: [
    "Sit ready while the rest of the fleet works the board",
    "Take any cargo mission the moment its escrow is funded",
    "Collect from the sender and deliver across either bank",
    "Return to Üsküdar and go back on call",
  ],

  startBattery: 100,
  reputation: 91,
};

/**
 * The fleet.
 *
 * Two aircraft per discipline, each with its own file next to this one saying
 * where it lives, what work it takes and how it flies. Add an aircraft by
 * adding a file and listing it here — the simulation reads the definitions and
 * needs no other change.
 *
 * The eight bases sit far apart on purpose, and the two aircraft in each
 * discipline are deliberately split across the city: Silivri and Çatalca out
 * west on the farmland, Belgrad Forest north and Aydos east, Levent and
 * Ataşehir watching either side of the Bosphorus, Kadıköy and Bakırköy running
 * parcels from opposite shores. Nothing shares a pad and no two aircraft fly
 * the same corridor.
 *
 * Within a discipline the two airframes are not duplicates. The pairing is
 * always a heavy and a light: the FlyCart against a fixed-wing VTOL, the T40
 * against the smaller T25, the Matrice 30T against a Mavic, the Matrice 350
 * against an EVO II. They accept the same work and fly it differently.
 */

import { kadikoyCargo } from "./kadikoy-cargo";
import { silivriAgri } from "./silivri-agri";
import { leventWatch } from "./levent-watch";
import { belgradFire } from "./belgrad-fire";
import { bakirkoyCargo } from "./bakirkoy-cargo";
import { catalcaAgri } from "./catalca-agri";
import { atasehirWatch } from "./atasehir-watch";
import { aydosFire } from "./aydos-fire";
import type { DroneDefinition } from "./types";

export type { DroneDefinition, HomeBase, FlightEnvelope, OnSiteBehaviour } from "./types";
export { toAgent } from "./types";

export const FLEET: DroneDefinition[] = [
  kadikoyCargo,
  silivriAgri,
  leventWatch,
  belgradFire,
  bakirkoyCargo,
  catalcaAgri,
  atasehirWatch,
  aydosFire,
];

const byId = new Map(FLEET.map((d) => [d.id, d]));

export function definitionFor(id: number): DroneDefinition | undefined {
  return byId.get(id);
}

/** Every home base, for drawing the pads on the map. */
export const BASES = FLEET.map((d) => ({ ...d.base, droneId: d.id, droneName: d.name }));

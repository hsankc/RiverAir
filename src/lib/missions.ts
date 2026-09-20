/**
 * RiverAir — mission pool
 * 
 * 50+ missions across 4 categories.
 * On startup 5 are active, the rest wait in the pool.
 * When a mission completes a new mission of a suitable type is pulled from the pool.
 */

import { Mission, MissionType } from "./data";

// İstanbul coordinates (real locations)
const locations: Record<string, [number, number]> = {
  kadikoy: [40.9900, 29.0270],
  besiktas: [41.0430, 29.0080],
  uskudar: [41.0250, 29.0150],
  sisli: [41.0600, 28.9870],
  atasehir: [40.9920, 29.1270],
  levent: [41.0820, 29.0100],
  sariyer: [41.1660, 29.0570],
  bakirkoy: [40.9800, 28.8720],
  zeytinburnu: [40.9950, 28.9020],
  pendik: [40.8770, 29.2330],
  tuzla: [40.8160, 29.3000],
  beykoz: [41.1250, 29.0950],
  sile: [41.1750, 29.6130],
  catalca: [41.1430, 28.4610],
  buyukcekmece: [41.0200, 28.5850],
  silivri: [41.0730, 28.2460],
  basaksehir: [41.0930, 28.8020],
  sancaktepe: [41.0000, 29.2300],
  arnavutkoy: [41.1840, 28.7400],
  kartal: [40.8880, 29.1900],
  // Campuses & special points
  bogaziciUni: [41.0850, 29.0500],
  itu: [41.1050, 29.0230],
  havaalani: [40.8980, 29.3092],
  liman: [40.9970, 29.0190],
  otogar: [41.0430, 28.8800],
  belgradForest: [41.1900, 28.9500],
};

// ═══ CARGO MISSIONS (15+) ═══
const cargoMissions: Omit<Mission, "id" | "createdAt" | "status" | "droneId">[] = [
  {
    type: "cargo", title: "Kadıköy → Beşiktaş Express",
    description: "2.1kg e-commerce package — standard delivery",
    fromLat: locations.kadikoy[0], fromLng: locations.kadikoy[1],
    toLat: locations.besiktas[0], toLng: locations.besiktas[1],
    payment: 2.5, priority: false,
  },
  {
    type: "cargo", title: "Şişli → Üsküdar Medicine",
    description: "Emergency medicine delivery — pharmacy order, fragile",
    fromLat: locations.sisli[0], fromLng: locations.sisli[1],
    toLat: locations.uskudar[0], toLng: locations.uskudar[1],
    payment: 4.2, priority: true,
  },
  {
    type: "cargo", title: "Beşiktaş → Ataşehir Food",
    description: "Hot food delivery — 3.5kg, handle with care",
    fromLat: locations.besiktas[0], fromLng: locations.besiktas[1],
    toLat: locations.atasehir[0], toLng: locations.atasehir[1],
    payment: 1.8, priority: false,
  },
  {
    type: "cargo", title: "Airport → Kadıköy Document",
    description: "Official document delivery — signature required",
    fromLat: locations.havaalani[0], fromLng: locations.havaalani[1],
    toLat: locations.kadikoy[0], toLng: locations.kadikoy[1],
    payment: 3.5, priority: true,
  },
  {
    type: "cargo", title: "Boğaziçi Univ → Levent Lab",
    description: "Lab samples — sensitive material, 0.8kg",
    fromLat: locations.bogaziciUni[0], fromLng: locations.bogaziciUni[1],
    toLat: locations.levent[0], toLng: locations.levent[1],
    payment: 5.0, priority: true,
  },
  {
    type: "cargo", title: "Port → Pendik Warehouse",
    description: "Customs doc and sample transport — 1.2kg",
    fromLat: locations.liman[0], fromLng: locations.liman[1],
    toLat: locations.pendik[0], toLng: locations.pendik[1],
    payment: 2.8, priority: false,
  },
  {
    type: "cargo", title: "Bakırköy → Zeytinburnu Pharmacy",
    description: "Prescription delivery — cold chain, urgent",
    fromLat: locations.bakirkoy[0], fromLng: locations.bakirkoy[1],
    toLat: locations.zeytinburnu[0], toLng: locations.zeytinburnu[1],
    payment: 3.0, priority: true,
  },
  {
    type: "cargo", title: "Tuzla → Sancaktepe Spare Parts",
    description: "Industrial spare parts — 4.5kg, non-fragile",
    fromLat: locations.tuzla[0], fromLng: locations.tuzla[1],
    toLat: locations.sancaktepe[0], toLng: locations.sancaktepe[1],
    payment: 3.2, priority: false,
  },
  {
    type: "cargo", title: "Sarıyer → Çatalca Post",
    description: "Postal delivery — standard package, 1.5kg",
    fromLat: locations.sariyer[0], fromLng: locations.sariyer[1],
    toLat: locations.catalca[0], toLng: locations.catalca[1],
    payment: 1.5, priority: false,
  },
  {
    type: "cargo", title: "Şişli → Bus Terminal Luggage",
    description: "Passenger luggage delivery — 5kg, large package",
    fromLat: locations.sisli[0], fromLng: locations.sisli[1],
    toLat: locations.otogar[0], toLng: locations.otogar[1],
    payment: 2.0, priority: false,
  },
  {
    type: "cargo", title: "Ataşehir → Pendik Electronics",
    description: "Electronics delivery — fragile, insured",
    fromLat: locations.atasehir[0], fromLng: locations.atasehir[1],
    toLat: locations.pendik[0], toLng: locations.pendik[1],
    payment: 4.5, priority: false,
  },
  {
    type: "cargo", title: "Üsküdar → Levent Groceries",
    description: "Online grocery order — 3kg, cold chain",
    fromLat: locations.uskudar[0], fromLng: locations.uskudar[1],
    toLat: locations.levent[0], toLng: locations.levent[1],
    payment: 2.2, priority: false,
  },
  {
    type: "cargo", title: "Beykoz → Başakşehir Organic",
    description: "Organic farm products — 2.8kg, fresh delivery",
    fromLat: locations.beykoz[0], fromLng: locations.beykoz[1],
    toLat: locations.basaksehir[0], toLng: locations.basaksehir[1],
    payment: 3.8, priority: false,
  },
  {
    type: "cargo", title: "Kadıköy → Şişli Clothing",
    description: "Online clothing order — light package, 0.5kg",
    fromLat: locations.kadikoy[0], fromLng: locations.kadikoy[1],
    toLat: locations.sisli[0], toLng: locations.sisli[1],
    payment: 1.2, priority: false,
  },
  {
    type: "cargo", title: "İTÜ → Ataşehir Books",
    description: "University books — 3.2kg, standard delivery",
    fromLat: locations.itu[0], fromLng: locations.itu[1],
    toLat: locations.atasehir[0], toLng: locations.atasehir[1],
    payment: 1.6, priority: false,
  },
];

// ═══ AGRICULTURE MISSIONS (12+) ═══
const agriculturalMissions: Omit<Mission, "id" | "createdAt" | "status" | "droneId">[] = [
  // Fields are compact rectangles — from/to are opposite corners, and the drone
  // flies a lawnmower sweep inside them. Roughly 300-450 m a side, which is a
  // plot a grower would actually treat in one run.
  {
    type: "agricultural", title: "Silivri sunflower spraying",
    description: "Pest control pass over an 18 ha sunflower plot",
    fromLat: 41.0700, fromLng: 28.2400, toLat: 41.0736, toLng: 28.2448,
    payment: 8.5, priority: false,
  },
  {
    type: "agricultural", title: "Catalca wheat irrigation",
    description: "Targeted irrigation across dry patches in the wheat field",
    fromLat: 41.1400, fromLng: 28.4560, toLat: 41.1434, toLng: 28.4606,
    payment: 7.2, priority: false,
  },
  {
    type: "agricultural", title: "Arnavutkoy sunflower survey",
    description: "NDVI health map before the fertiliser pass",
    fromLat: 41.1810, fromLng: 28.7360, toLat: 41.1842, toLng: 28.7404,
    payment: 6.4, priority: false,
  },
  {
    type: "agricultural", title: "Sile hazelnut grove spraying",
    description: "Fungicide pass over the grove after a wet week",
    fromLat: 41.1700, fromLng: 29.6060, toLat: 41.1734, toLng: 29.6108,
    payment: 9.1, priority: false,
  },
  {
    type: "agricultural", title: "Beykoz orchard fertilising",
    description: "Liquid fertiliser over the terraced orchard",
    fromLat: 41.1210, fromLng: 29.0890, toLat: 41.1242, toLng: 29.0934,
    payment: 7.8, priority: false,
  },
  {
    type: "agricultural", title: "Buyukcekmece greenhouse belt",
    description: "Pest scouting across the greenhouse belt",
    fromLat: 41.0160, fromLng: 28.5800, toLat: 41.0194, toLng: 28.5846,
    payment: 6.9, priority: false,
  },
  {
    type: "agricultural", title: "Catalca maize irrigation",
    description: "Second irrigation pass over the maize block",
    fromLat: 41.1520, fromLng: 28.4700, toLat: 41.1556, toLng: 28.4750,
    payment: 8.0, priority: false,
  },
  {
    type: "agricultural", title: "Silivri vineyard treatment",
    description: "Mildew treatment along the vine rows",
    fromLat: 41.0820, fromLng: 28.2620, toLat: 41.0852, toLng: 28.2664,
    payment: 8.8, priority: false,
  },
  {
    type: "agricultural", title: "Arnavutkoy pasture seeding",
    description: "Overseeding a thinned pasture after grazing",
    fromLat: 41.1930, fromLng: 28.7500, toLat: 41.1966, toLng: 28.7548,
    payment: 7.5, priority: false,
  },
  {
    type: "agricultural", title: "Sile field soil sampling",
    description: "Grid survey ahead of the autumn planting",
    fromLat: 41.1600, fromLng: 29.5900, toLat: 41.1632, toLng: 29.5944,
    payment: 6.2, priority: false,
  },
  {
    type: "agricultural", title: "Catalca orchard frost watch",
    description: "Thermal sweep of the orchard before a cold night",
    fromLat: 41.1320, fromLng: 28.4420, toLat: 41.1352, toLng: 28.4464,
    payment: 7.0, priority: true,
  },
  {
    type: "agricultural", title: "Buyukcekmece olive grove",
    description: "Precision fertilising across the olive terraces",
    fromLat: 41.0280, fromLng: 28.5950, toLat: 41.0314, toLng: 28.5996,
    payment: 8.3, priority: false,
  },
];

const fireMissions: Omit<Mission, "id" | "createdAt" | "status" | "droneId">[] = [
  {
    type: "fire", title: "Belgrad Forest thermal sweep",
    description: "Hot-spot scan along the northern treeline after a dry spell",
    fromLat: 41.1900, fromLng: 28.9500, toLat: 41.2060, toLng: 28.9300,
    payment: 15, priority: true,
  },
  {
    type: "fire", title: "Aydos Forest smoke report",
    description: "Smoke reported by a hiker - confirm and locate",
    fromLat: 40.9950, fromLng: 29.2300, toLat: 41.0080, toLng: 29.2450,
    payment: 14.2, priority: true,
  },
  {
    type: "fire", title: "Polonezkoy scrub fire",
    description: "Scrub fire on the ridge, wind pushing it north",
    fromLat: 41.1160, fromLng: 29.1400, toLat: 41.1280, toLng: 29.1560,
    payment: 16.5, priority: true,
  },
  {
    type: "fire", title: "Kemerburgaz treeline patrol",
    description: "Routine patrol of the forest boundary",
    fromLat: 41.1700, fromLng: 28.9100, toLat: 41.1820, toLng: 28.9240,
    payment: 11.0, priority: false,
  },
  {
    type: "fire", title: "Tuzla industrial fire support",
    description: "Thermal overwatch above a warehouse fire",
    fromLat: 40.8200, fromLng: 29.3000, toLat: 40.8300, toLng: 29.3140,
    payment: 17.8, priority: true,
  },
  {
    type: "fire", title: "Sariyer coastal search",
    description: "Search along the shoreline after a distress call",
    fromLat: 41.1700, fromLng: 29.0500, toLat: 41.1840, toLng: 29.0660,
    payment: 18.5, priority: true,
  },
  {
    type: "fire", title: "Beykoz forest patrol",
    description: "Evening patrol over the eastern forest block",
    fromLat: 41.1300, fromLng: 29.1000, toLat: 41.1420, toLng: 29.1150,
    payment: 10.8, priority: false,
  },
  {
    type: "fire", title: "Cekmekoy hot-spot check",
    description: "Recheck of a hot spot logged yesterday",
    fromLat: 41.0400, fromLng: 29.2000, toLat: 41.0520, toLng: 29.2150,
    payment: 12.4, priority: false,
  },
  {
    type: "fire", title: "Silivri stubble fire",
    description: "Stubble burning spreading past its boundary",
    fromLat: 41.0900, fromLng: 28.2800, toLat: 41.1020, toLng: 28.2950,
    payment: 13.6, priority: true,
  },
  {
    type: "fire", title: "Adalar pine grove watch",
    description: "Fire watch over the island pines in high season",
    fromLat: 40.8560, fromLng: 29.1200, toLat: 40.8660, toLng: 29.1330,
    payment: 12.0, priority: false,
  },
];

const trafficMissions: Omit<Mission, "id" | "createdAt" | "status" | "droneId">[] = [
  {
    type: "traffic", title: "Bosphorus Bridge approach",
    description: "Flow monitoring on the European approach at peak hour",
    fromLat: 41.0400, fromLng: 29.0300, toLat: 41.0480, toLng: 29.0420,
    payment: 6.5, priority: false,
  },
  {
    type: "traffic", title: "FSM Bridge corridor",
    description: "Queue length survey across the second bridge",
    fromLat: 41.0900, fromLng: 29.0580, toLat: 41.0990, toLng: 29.0700,
    payment: 6.8, priority: false,
  },
  {
    type: "traffic", title: "Levent junction analysis",
    description: "Turning-movement counts at the Levent interchange",
    fromLat: 41.0800, fromLng: 29.0080, toLat: 41.0870, toLng: 29.0190,
    payment: 5.9, priority: false,
  },
  {
    type: "traffic", title: "Mecidiyekoy incident survey",
    description: "Incident reported - assess blockage and diversion",
    fromLat: 41.0670, fromLng: 28.9950, toLat: 41.0740, toLng: 29.0060,
    payment: 7.4, priority: true,
  },
  {
    type: "traffic", title: "TEM Mahmutbey survey",
    description: "Motorway flow survey at the Mahmutbey junction",
    fromLat: 41.0600, fromLng: 28.8200, toLat: 41.0680, toLng: 28.8330,
    payment: 6.2, priority: false,
  },
  {
    type: "traffic", title: "Kadikoy ferry terminal",
    description: "Pedestrian and vehicle flow around the terminal",
    fromLat: 40.9900, fromLng: 29.0230, toLat: 40.9970, toLng: 29.0340,
    payment: 5.6, priority: false,
  },
  {
    type: "traffic", title: "Bakirkoy coast road",
    description: "Weekend congestion survey along the coast road",
    fromLat: 40.9770, fromLng: 28.8660, toLat: 40.9840, toLng: 28.8780,
    payment: 5.8, priority: false,
  },
  {
    type: "traffic", title: "Pendik junction counts",
    description: "Approach counts at the Pendik interchange",
    fromLat: 40.8750, fromLng: 29.2280, toLat: 40.8820, toLng: 29.2390,
    payment: 6.0, priority: false,
  },
  {
    type: "traffic", title: "Beylikduzu E-5 survey",
    description: "Speed and headway survey on the western E-5",
    fromLat: 41.0000, fromLng: 28.6380, toLat: 41.0070, toLng: 28.6500,
    payment: 6.3, priority: false,
  },
  {
    type: "traffic", title: "Uskudar shoreline survey",
    description: "Shoreline road survey during the evening peak",
    fromLat: 41.0220, fromLng: 29.0100, toLat: 41.0290, toLng: 29.0210,
    payment: 5.7, priority: false,
  },
];

// ═══ COMBINE ALL MISSIONS ═══
const allMissionTemplates = [
  ...cargoMissions,
  ...agriculturalMissions,
  ...fireMissions,
  ...trafficMissions,
];

// Pull a random mission from the pool (of a specific type or any)
let missionIdCounter = 100;

export function pickRandomMission(preferType?: MissionType): Mission {
  const pool = preferType
    ? allMissionTemplates.filter(m => m.type === preferType)
    : allMissionTemplates;

  const template = pool[Math.floor(Math.random() * pool.length)];
  missionIdCounter++;

  return {
    ...template,
    id: missionIdCounter,
    status: "open",
    droneId: null,
    createdAt: new Date(),
  };
}

// Missions that are open at startup (pull 8 from the pool)
export function generateInitialOpenMissions(): Mission[] {
  const missions: Mission[] = [];
  const types: MissionType[] = ["cargo", "cargo", "agricultural", "fire", "traffic", "cargo", "agricultural", "fire"];

  types.forEach(type => {
    missions.push(pickRandomMission(type));
  });

  return missions;
}

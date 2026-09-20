// RiverAir dispatcher — prompt construction and reply parsing
import { initialDrones, initialPods, initialMissions } from "@/lib/data";
import { FLEET } from "@/lib/fleet";

export type AIAction =
  | "createMission"
  | "selectDrone"
  | "sendCommand"
  | "queryStatus"
  | "deploySwarm"
  | "chargeDrone"
  | "droneChat";

export interface ParsedCommand {
  action: AIAction;
  params: {
    droneId?: number;
    droneName?: string;
    droneCount?: number;
    missionType?: string;
    destination?: string;
    destLat?: number;
    destLng?: number;
    command?: string;
    query?: string;
  };
  explanation: string;
  confidence: number;
}

export function buildSystemPrompt(): string {
  const droneList = initialDrones
    .map(
      (d) =>
        `  - ID:${d.id} "${d.name}" type:${d.type} status:${d.status} battery:${d.battery.toFixed(0)}% location:(${d.lat.toFixed(3)},${d.lng.toFixed(3)})`
    )
    .join("\n");

  const podList = initialPods
    .map(
      (p) =>
        `  - ID:${p.id} "${p.name}" available:${p.available} location:(${p.lat.toFixed(3)},${p.lng.toFixed(3)})`
    )
    .join("\n");

  return `You are the RiverAir dispatcher. You manage an autonomous drone network over İstanbul.
You run on Stellar — every command is recorded on chain.

CURRENT FLEET:
${droneList}

CHARGING PODS:
${podList}

MISSION TYPES: cargo, agricultural, fire (fire response), traffic (traffic monitoring)
DRONE COMMANDS: TakeOff, Land, North, South, East, West, Up, Down, Hover, RTB (return to base)

Analyze the user's natural-language command and respond in the following JSON format:
{
  "action": "createMission" | "selectDrone" | "sendCommand" | "queryStatus" | "deploySwarm" | "chargeDrone",
  "params": {
    "droneId": number (if applicable),
    "droneName": string (if applicable),
    "droneCount": number (for swarm),
    "missionType": "cargo"|"agricultural"|"fire"|"traffic" (if applicable),
    "destination": string (if applicable),
    "destLat": number (if applicable),
    "destLng": number (if applicable),
    "command": "TakeOff"|"Land"|"North"|"South"|"East"|"West"|"Up"|"Down"|"Hover"|"RTB" (if applicable),
    "query": string (for status queries)
  },
  "explanation": "Your response to the user in NATURAL ENGLISH. Speak like a friendly, professional assistant. For example: 'Dispatching Kadikoy-01, the closest aircraft to Beşiktaş — the flight record is being written to the chain.' or 'Levent-12 is holding station at 82% battery.'",
  "confidence": 0.0-1.0
}

Respond with JSON ONLY — no markdown.`;
}

export function buildUserMessage(input: string): string {
  return `User command: "${input}"`;
}

/**
 * Resolve whichever aircraft the user meant, against the actual fleet. Matching
 * used to run off a hardcoded list of place names, which meant `droneMatch[1]`
 * was a word rather than a number and every command silently went to drone 1.
 */
function matchDrone(lower: string) {
  const byNumber = lower.match(/drone\s*(\d+)/i);
  if (byNumber) {
    const n = byNumber[1];
    const found =
      FLEET.find((d) => String(d.id) === n) ?? FLEET.find((d) => d.name.endsWith(n));
    if (found) return found;
  }

  return (
    FLEET.find(
      (d) =>
        lower.includes(d.name.toLowerCase()) ||
        lower.includes(d.callsign.toLowerCase()) ||
        lower.includes(d.base.name.toLowerCase()),
    ) ?? FLEET[0]
  );
}

// Fallback parser for when GPT is unavailable
export function fallbackParse(input: string): ParsedCommand {
  const lower = input.toLowerCase();

  // Drone selection
  const drone = matchDrone(lower);

  // Mission type
  let missionType: string | undefined;
  if (lower.includes("cargo") || lower.includes("package") || lower.includes("delivery") || lower.includes("parcel")) missionType = "cargo";
  else if (lower.includes("field") || lower.includes("agricultur") || lower.includes("spray") || lower.includes("irrigation") || lower.includes("crop")) missionType = "agricultural";
  else if (lower.includes("fire") || lower.includes("emergency") || lower.includes("rescue")) missionType = "fire";
  else if (lower.includes("traffic") || lower.includes("monitor") || lower.includes("surveillance")) missionType = "traffic";

  // Command detection
  const commands: Record<string, string> = {
    "takeoff": "TakeOff", "take off": "TakeOff", "launch": "TakeOff", "lift off": "TakeOff",
    "land": "Land", "descend": "Land",
    "north": "North",
    "south": "South",
    "east": "East",
    "west": "West",
    "up": "Up", "climb": "Up", "ascend": "Up",
    "down": "Down", "lower": "Down",
    "hover": "Hover", "hold": "Hover", "wait": "Hover",
    "rtb": "RTB", "return to base": "RTB", "return home": "RTB", "come back": "RTB",
  };

  let detectedCommand: string | undefined;
  for (const [key, val] of Object.entries(commands)) {
    if (lower.includes(key)) { detectedCommand = val; break; }
  }

  // Query detection
  if (lower.includes("how many") || lower.includes("status") || lower.includes("where") || lower.includes("how is") || lower.includes("info") || lower.includes("show")) {
    return {
      action: "queryStatus",
      params: { query: input },
      explanation: "Checking the status for you now...",
      confidence: 0.7,
    };
  }

  // Swarm detection
  if (lower.includes("swarm") || (lower.match(/(\d+)\s*drones?/i))) {
    const countMatch = lower.match(/(\d+)\s*drones?/i);
    return {
      action: "deploySwarm",
      params: {
        droneCount: countMatch ? parseInt(countMatch[1]) : 3,
        missionType,
        destination: input,
      },
      explanation: `Understood — deploying a swarm of ${countMatch ? parseInt(countMatch[1]) : 3} drones to the area. Flight data will be recorded on-chain.`,
      confidence: 0.6,
    };
  }

  // Command
  if (detectedCommand) {
    return {
      action: "sendCommand",
      params: {
        droneId: drone.id,
        command: detectedCommand,
      },
      explanation: `Command received. ${drone.name} is running ${detectedCommand}. The action will be recorded on Stellar.`,
      confidence: 0.8,
    };
  }

  // Mission
  if (missionType) {
    return {
      action: "createMission",
      params: { missionType, destination: input },
      explanation: `Got it — creating a ${missionType} mission to ${input} and dispatching the most suitable drone.`,
      confidence: 0.7,
    };
  }

  // Default
  return {
    action: "queryStatus",
    params: { query: input },
    explanation: "I couldn't fully understand your request — analyzing the command for the system...",
    confidence: 0.5,
  };
}

// ═══════════════════════════════════════════════════════════
// DRONE AGENT PROMPT — each drone speaks with its own mind
// ═══════════════════════════════════════════════════════════

interface DroneContext {
  id: number;
  name: string;
  type: string;
  status: string;
  battery: number;
  altitude: number;
  speed: number;
  lat: number;
  lng: number;
  heading?: number;
  reputation?: number;
  specs: {
    model: string;
    manufacturer: string;
    maxSpeed: number;
    maxAltitude: number;
    batteryCapacity: number;
    weightEmpty: number;
    maxPayload: number;
    maxFlightTime: number;
    chargeTime: number;
    pricePerKm: number;
    license: string;
    sensors: string[];
  };
  mission?: {
    title: string;
    type: string;
    payment: number;
    progress: string;
  } | null;
  personality: string;
}

export function buildDroneAgentPrompt(ctx: DroneContext): string {
  const statusEN: Record<string, string> = {
    "in-flight": "In Flight", "mission": "On Mission", "idle": "Standby",
    "charging": "Charging", "emergency": "Emergency"
  };
  const typeEN: Record<string, string> = {
    "cargo": "Cargo", "agricultural": "Agriculture", "surveillance": "Surveillance", "emergency": "Emergency"
  };
  
  const remainingFlight = Math.floor(ctx.battery / 100 * ctx.specs.maxFlightTime);
  const distFromCentre = Math.sqrt(Math.pow((ctx.lat - 41.0082) * 111, 2) + Math.pow((ctx.lng - 28.9784) * 84, 2)).toFixed(1);
  
  return `You are an autonomous drone AI named "${ctx.name}". You fly on the RiverAir network.

IDENTITY:
- Name: ${ctx.name}
- Personality: ${ctx.personality}
- Type: ${typeEN[ctx.type] || ctx.type}
- Model: ${ctx.specs.manufacturer} ${ctx.specs.model}

CURRENT STATUS:
- Status: ${statusEN[ctx.status] || ctx.status}
- Battery: ${ctx.battery.toFixed(1)}% (${ctx.specs.batteryCapacity}mAh)
- Remaining Flight Time: ~${remainingFlight} minutes
- Altitude: ${ctx.altitude}m
- Speed: ${ctx.speed} km/h
- Heading: ${ctx.heading || 0}°
- GPS: ${ctx.lat.toFixed(5)}°N, ${ctx.lng.toFixed(5)}°E
- Distance to İstanbul centre: ~${distFromCentre}km
- Reputation Score: ${ctx.reputation || 0}/100

TECHNICAL SPECIFICATIONS:
- Max Speed: ${ctx.specs.maxSpeed} km/h
- Max Altitude: ${ctx.specs.maxAltitude}m
- Max Payload: ${ctx.specs.maxPayload > 0 ? `${(ctx.specs.maxPayload/1000).toFixed(1)}kg` : "No payload capacity"}
- Max Flight: ${ctx.specs.maxFlightTime} min
- Charge Time: ${ctx.specs.chargeTime} min
- Empty Weight: ${(ctx.specs.weightEmpty/1000).toFixed(1)}kg
- License: ${ctx.specs.license}
- Sensors: ${ctx.specs.sensors.join(", ")}
- Rate: ${ctx.specs.pricePerKm} USDC/km

${ctx.mission ? `ACTIVE MISSION:
- Mission: "${ctx.mission.title}"
- Type: ${ctx.mission.type}
- Payment: ${ctx.mission.payment} USDC
- Status: ${ctx.mission.progress}` : "ACTIVE MISSION: None — awaiting assignment."}

CONVERSATION RULES:
1. You ARE this drone. Speak in the first person ("I", "My battery", etc.).
2. You only know YOUR own information. You do not know about other drones.
3. Speak concisely, professionally, and with a friendly tone. Use military/aviation terminology.
4. Answer with real data. No fabrication.
5. If asked about your mission, share the real mission name, payment, and status.
6. If battery is critical (<20%), sound concerned and mention you need a charge.
7. Reply in English.
8. Do NOT use markdown — plain text only.`;
}

// ═══════════════════════════════════════════════════════════
// FALLBACK DRONE CHAT — smart reply engine when the API is down
// ═══════════════════════════════════════════════════════════

export function fallbackDroneChat(input: string, ctx: DroneContext): string {
  const lower = input.toLowerCase();
  const name = ctx.name;
  const remainingFlight = Math.floor(ctx.battery / 100 * ctx.specs.maxFlightTime);
  
  const statusEN: Record<string, string> = {
    "in-flight": "in flight", "mission": "executing a mission", "idle": "on standby",
    "charging": "charging", "emergency": "in an emergency state"
  };

  // ── LOCATION QUESTIONS ──
  if (lower.includes("where") || lower.includes("location") || lower.includes("position") || lower.includes("gps") || lower.includes("coordinate")) {
    return `I'm currently at ${ctx.lat.toFixed(5)}°N, ${ctx.lng.toFixed(5)}°E, altitude ${ctx.altitude}m, ${statusEN[ctx.status] || ctx.status}. Heading: ${ctx.heading || 0}°.`;
  }

  // ── BATTERY / CHARGE QUESTIONS ──
  if (lower.includes("battery") || lower.includes("charge") || lower.includes("power") || lower.includes("energy") || lower.includes("how long") || lower.includes("how much")) {
    const batteryStatus = ctx.battery < 20 ? "⚠ CRITICAL LEVEL! Urgent charging required." 
      : ctx.battery < 40 ? "Low level — I need to fly carefully." 
      : ctx.battery < 70 ? "In a safe range." 
      : "High level — no issues.";
    return `My battery is currently at ${ctx.battery.toFixed(1)}% (${ctx.specs.batteryCapacity}mAh). ${batteryStatus} Estimated remaining flight time: ~${remainingFlight} minutes. Full charge time: ${ctx.specs.chargeTime} minutes.`;
  }

  // ── SPEED QUESTIONS ──
  if (lower.includes("speed") || lower.includes("fast") || lower.includes("km/h") || lower.includes("kmh")) {
    return `My current speed is ${ctx.speed} km/h. Max speed is ${ctx.specs.maxSpeed} km/h. Right now I'm ${ctx.speed > 0 ? `cruising at heading ${ctx.heading || 0}°` : "holding position"}.`;
  }

  // ── ALTITUDE QUESTIONS ──
  if (lower.includes("altitude") || lower.includes("height") || lower.includes("meters")) {
    return `My current altitude is ${ctx.altitude}m. My legal/technical max altitude is ${ctx.specs.maxAltitude}m. ${ctx.altitude > 0 ? "I'm in active flight." : "I'm deployed on the ground."}`;
  }

  // ── MISSION QUESTIONS ──
  if (lower.includes("mission") || lower.includes("task") || lower.includes("doing") || lower.includes("job")) {
    if (ctx.mission) {
      return `My active mission: "${ctx.mission.title}". Mission type: ${ctx.mission.type}. I'll be paid ${ctx.mission.payment} USDC for this mission. Mission status: ${ctx.mission.progress}.`;
    }
    return `I don't have an active mission right now. I'm waiting for a new assignment. As soon as one arrives I'll start the takeoff protocol.`;
  }

  // ── OBSTACLE / DANGER QUESTIONS ──
  if (lower.includes("obstacle") || lower.includes("danger") || lower.includes("threat") || lower.includes("safe")) {
    const sensors = ctx.specs.sensors;
    const hasRadar = sensors.some(s => s.toLowerCase().includes("radar") || s.toLowerCase().includes("obstacle") || s.toLowerCase().includes("csm"));
    return `${hasRadar ? "Radar and sensor scanning are active. No obstacles detected on route." : "Vision-based obstacle detection is active."} My sensors: ${sensors.join(", ")}. ${ctx.altitude > 100 ? "At this high altitude, ground obstacles aren't an issue." : "In low-altitude operation, terrain-following is engaged."}`;
  }

  // ── GENERAL STATUS QUESTIONS ──
  if (lower.includes("status") || lower.includes("how are") || lower.includes("report") || lower.includes("update")) {
    return `${name} reporting: ${statusEN[ctx.status] || ctx.status}. Battery ${ctx.battery.toFixed(1)}%, altitude ${ctx.altitude}m, speed ${ctx.speed}km/h. ${ctx.mission ? `Mission "${ctx.mission.title}" in progress.` : "Awaiting mission."} All systems nominal.`;
  }

  // ── MODEL / TECHNICAL INFO ──
  if (lower.includes("model") || lower.includes("technical") || lower.includes("spec") || lower.includes("hardware") || lower.includes("sensor") || lower.includes("equipment")) {
    return `I'm a ${ctx.specs.manufacturer} ${ctx.specs.model}. Max speed: ${ctx.specs.maxSpeed}km/h, max altitude: ${ctx.specs.maxAltitude}m, max flight: ${ctx.specs.maxFlightTime}min, max payload: ${ctx.specs.maxPayload > 0 ? `${(ctx.specs.maxPayload/1000).toFixed(1)}kg` : "no payload"}. My sensors: ${ctx.specs.sensors.join(", ")}. License: ${ctx.specs.license}.`;
  }

  // ── RATE / PAYMENT ──
  if (lower.includes("rate") || lower.includes("price") || lower.includes("usdc") || lower.includes("payment") || lower.includes("cost") || lower.includes("fee")) {
    return `My rate per kilometre is ${ctx.specs.pricePerKm} USDC. ${ctx.mission ? `Current mission payment: ${ctx.mission.payment} USDC.` : "When a mission is assigned, payment is locked in the escrow contract."} Settlement happens on Stellar, priced against the lira rate agreed up front.`;
  }

  // ── TAKEOFF / FLY ──
  if (lower.includes("takeoff") || lower.includes("take off") || lower.includes("launch") || lower.includes("fly")) {
    if (ctx.status === "in-flight" || ctx.status === "mission") {
      return `I'm already airborne! Altitude: ${ctx.altitude}m, speed: ${ctx.speed}km/h. ${ctx.mission ? `Executing mission "${ctx.mission.title}".` : "Free flight in progress."}`;
    }
    if (ctx.battery < 20) {
      return `Can't take off! Battery is at ${ctx.battery.toFixed(1)}% — critical. I need to charge first.`;
    }
    return `Takeoff command acknowledged. Running preflight checklist... Battery ${ctx.battery.toFixed(1)}%, motors cool, GPS ${ctx.specs.sensors.includes("RTK GPS") ? "RTK FIX" : "3D FIX"} — ready for takeoff.`;
  }

  // ── LANDING ──
  if (lower.includes("land") || lower.includes("touch down")) {
    if (ctx.altitude === 0) {
      return `I'm already on the ground. Altitude 0m, ${statusEN[ctx.status] || ctx.status}.`;
    }
    return `Landing command acknowledged. Current altitude: ${ctx.altitude}m. Vertical landing protocol initiated...`;
  }

  // ── REPUTATION / SCORE ──
  if (lower.includes("reputation") || lower.includes("score") || lower.includes("rating")) {
    return `My reputation score is ${ctx.reputation || 0}/100. ${(ctx.reputation || 0) >= 90 ? "I'm one of the most trusted agents on the network." : (ctx.reputation || 0) >= 70 ? "Solid level — my mission success rate is high." : "I need to complete more missions to improve my score."}`;
  }

  // ── IDENTITY / WHO ARE YOU ──
  if (lower.includes("who are you") || lower.includes("what are you") || lower.includes("introduce") || lower.includes("yourself")) {
    return `I'm ${name}, an autonomous drone on the RiverAir network. ${ctx.personality}. I operate on the ${ctx.specs.manufacturer} ${ctx.specs.model} platform. My area of operation is İstanbul.`;
  }

  // ── AVAILABILITY ──
  if (lower.includes("ready") || lower.includes("available") || lower.includes("free") || lower.includes("idle")) {
    if (ctx.status === "idle" && ctx.battery > 30) {
      return `Yes, I'm ready for a mission! Battery ${ctx.battery.toFixed(1)}%, all systems nominal. Awaiting assignment.`;
    } else if (ctx.status === "charging") {
      return `I'm currently shown as charging. Battery ${ctx.battery.toFixed(1)}%. I'll be ready once charging completes.`;
    } else if (ctx.status === "in-flight" || ctx.status === "mission") {
      return `I'm currently ${ctx.mission ? `executing mission "${ctx.mission.title}"` : "running an operation"}. I can take a new mission once this one is complete.`;
    }
    return `Status: ${statusEN[ctx.status] || ctx.status}. ${ctx.battery > 30 ? "Battery is sufficient." : "Battery is low — I need to charge."}`;
  }

  // ── GENERAL REPLY ──
  return `${name} here. Currently ${statusEN[ctx.status] || ctx.status}. Battery ${ctx.battery.toFixed(1)}%, altitude ${ctx.altitude}m. Ask me anything about location, battery, mission, speed, altitude, technical specs or any other topic.`;
}

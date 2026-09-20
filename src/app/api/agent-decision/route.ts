import { NextRequest, NextResponse } from "next/server";
import { askGemini, parseJsonReply } from "@/lib/ai/gemini";

// ── /api/agent-decision ───────────────────────────────────────
// Endpoint where the FleetAgent makes decisions using Gemini.
// Returns 404 if no API key — FleetAgent then falls back.

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 404 });
  }

  try {
    const { missions, drones } = await req.json();

    const systemPrompt = `You are RiverAir's autonomous fleet management AI agent.
You will be given a list of open drone missions and available drones.
Determine the optimal drone-mission match.

Consider the following when deciding:
- Drone proximity to the mission (distance)
- Drone type vs mission compatibility (emergency → fire, agricultural → crop)
- Drone battery level (do not assign a low-battery drone)
- Mission payment amount (higher priority)

Reply ONLY in JSON format, nothing else:
{ "droneId": <number>, "missionId": <number>, "reason": "<brief English explanation>" }`;

    const userPrompt = `Open Missions:
${JSON.stringify(missions, null, 2)}

Available Drones:
${JSON.stringify(drones, null, 2)}

Find the best match.`;

    const reply = await askGemini({
      apiKey,
      system: systemPrompt,
      input: userPrompt,
      temperature: 0.3,
    });

    return NextResponse.json(parseJsonReply(reply));

  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

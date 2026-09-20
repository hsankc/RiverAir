import { NextRequest, NextResponse } from "next/server";

// ── /api/agent-decision ───────────────────────────────────────
// Endpoint where the FleetAgent makes decisions using GPT-4o-mini.
// Returns 404 if no API key — FleetAgent then falls back.

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

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

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "openai_error" }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";

    // JSON parse
    const decision = JSON.parse(content.trim());
    return NextResponse.json(decision);

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

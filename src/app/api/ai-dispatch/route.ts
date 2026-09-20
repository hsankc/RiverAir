import { NextRequest } from "next/server";
import { buildSystemPrompt, buildUserMessage, buildDroneAgentPrompt, fallbackParse, fallbackDroneChat } from "@/lib/ai/dispatcher";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { message, droneContext } = await request.json();

    if (!message || typeof message !== "string") {
      return Response.json(
        { error: "Please enter a valid command." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY || "";

    // ═══ DRONE AGENT MODE: chat with an individual drone ═══
    if (droneContext) {
      const systemPrompt = buildDroneAgentPrompt(droneContext);

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message }
            ],
            temperature: 0.6,
            max_tokens: 300,
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || JSON.stringify(data));
        }

        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error("Empty response");
        }

        return Response.json({
          success: true,
          parsed: { explanation: content, action: "droneChat", params: {}, confidence: 1 },
          source: "gpt-drone-agent",
        });
      } catch (aiError) {
        // Fallback: build a smart reply from the drone's own data
        const fallbackResponse = fallbackDroneChat(message, droneContext);
        return Response.json({
          success: true,
          parsed: { explanation: fallbackResponse, action: "droneChat", params: {}, confidence: 0.9 },
          source: "fallback-drone",
        });
      }
    }

    // ═══ FLEET DISPATCHER MODE: general fleet management ═══
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: buildUserMessage(message) }
          ],
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || JSON.stringify(data));
      }

      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      const parsed = JSON.parse(content);

      return Response.json({
        success: true,
        parsed,
        source: "gpt",
      });
    } catch (aiError: unknown) {
      console.error("OpenAI error, using fallback:", (aiError as Error).message);
      const parsed = fallbackParse(message);
      return Response.json({
        success: true,
        parsed,
        source: "fallback",
        aiError: (aiError as Error).message,
      });
    }
  } catch (error: unknown) {
    return Response.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}

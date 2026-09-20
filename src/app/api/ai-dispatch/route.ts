import { NextRequest } from "next/server";
import { buildSystemPrompt, buildUserMessage, buildDroneAgentPrompt, fallbackParse, fallbackDroneChat } from "@/lib/ai/dispatcher";
import { askGemini, parseJsonReply } from "@/lib/ai/gemini";

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

    const apiKey = process.env.GEMINI_API_KEY || "";

    // ═══ DRONE AGENT MODE: chat with an individual drone ═══
    if (droneContext) {
      const systemPrompt = buildDroneAgentPrompt(droneContext);

      try {
        const content = await askGemini({
          apiKey,
          system: systemPrompt,
          input: message,
          temperature: 0.6,
        });

        return Response.json({
          success: true,
          parsed: { explanation: content, action: "droneChat", params: {}, confidence: 1 },
          source: "gemini-drone-agent",
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
      const reply = await askGemini({
        apiKey,
        system: buildSystemPrompt(),
        input: buildUserMessage(message),
        temperature: 0.3,
      });

      return Response.json({
        success: true,
        parsed: parseJsonReply(reply),
        source: "gemini",
      });
    } catch (aiError: unknown) {
      console.error("Gemini error, using fallback:", (aiError as Error).message);
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

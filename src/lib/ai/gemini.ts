/**
 * The Gemini Interactions API, in the one shape this project needs.
 *
 * Three call sites want the same thing — a system instruction, one user
 * message, and text back — so the request is built once here rather than
 * three times with three chances to drift.
 *
 * Every caller already has a deterministic fallback for when the model is
 * unavailable, so this throws rather than returning a sentinel: a missing key,
 * a rate limit and a malformed reply all land in the same catch.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MODEL = "gemini-3.8-flash";

interface AskOptions {
  apiKey: string;
  /** Behaviour guidance, sent as system_instruction. */
  system: string;
  /** The user's message. */
  input: string;
  temperature?: number;
}

export async function askGemini({ apiKey, system, input, temperature }: AskOptions): Promise<string> {
  if (!apiKey) throw new Error("No Gemini API key configured");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      input,
      system_instruction: system,
      ...(temperature === undefined ? {} : { generation_config: { temperature } }),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message ?? JSON.stringify(data));
  }

  const text = readOutput(data);
  if (!text) throw new Error("Empty response from Gemini");

  return text;
}

/**
 * Pull the reply text out of an Interaction.
 *
 * `output_text` is a convenience the SDKs compute; it is not in the REST body.
 * What comes back is `steps`, and a thinking model puts at least two in there —
 * a `thought` step carrying only an opaque signature, then the `model_output`
 * whose `content` holds the parts we want. Reading `steps[0]` would hand back
 * nothing, so select by type and concatenate the text parts.
 */
function readOutput(data: unknown): string {
  if (!data || typeof data !== "object") return "";

  const direct = (data as { output_text?: unknown }).output_text;
  if (typeof direct === "string" && direct.length > 0) return direct;

  const steps = (data as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) return "";

  const parts: string[] = [];
  for (const step of steps) {
    if (!step || typeof step !== "object") continue;
    const { type, content } = step as { type?: unknown; content?: unknown };
    if (type !== "model_output" || !Array.isArray(content)) continue;

    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const piece = part as { type?: unknown; text?: unknown };
      if (piece.type === "text" && typeof piece.text === "string") {
        parts.push(piece.text);
      }
    }
  }

  return parts.join("").trim();
}

/**
 * A model asked for JSON often hands it back inside a ``` fence. Strip that
 * before parsing, so a reply that is correct but decorated does not drop the
 * caller into its fallback over formatting alone.
 */
export function parseJsonReply<T>(text: string): T {
  const fenced = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse((fenced ? fenced[1] : text).trim()) as T;
}

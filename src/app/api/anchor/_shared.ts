import { NextResponse } from "next/server";
import { AnchorError } from "@/lib/stellar/anchor";

/**
 * Anchor calls go through the server so the browser never has to deal with the
 * anchor's CORS policy, and so a production deployment can add rate limiting in
 * one place. The anchor's own error text is passed through — it is written for
 * developers and is more useful than anything we would invent.
 */
export function fail(e: unknown) {
  if (e instanceof AnchorError) {
    return NextResponse.json(
      { error: e.message, endpoint: e.endpoint },
      { status: e.status >= 400 && e.status < 600 ? e.status : 502 },
    );
  }
  const message = e instanceof Error ? e.message : "Anchor request failed";
  return NextResponse.json({ error: message }, { status: 502 });
}

/** Pull the SEP-10 session token off the request. */
export function bearer(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new AnchorError("Sign in to the anchor first", 401, "sep10");
  return token;
}

import { NextResponse } from "next/server";
import { submitChallenge } from "@/lib/stellar/anchor";
import { fail } from "../_shared";

/** SEP-10 step two: trade the signed challenge for a session token. */
export async function POST(req: Request) {
  try {
    const { transaction } = (await req.json()) as { transaction?: string };
    if (!transaction) {
      return NextResponse.json({ error: "A signed challenge is required" }, { status: 400 });
    }
    return NextResponse.json(await submitChallenge(transaction));
  } catch (e) {
    return fail(e);
  }
}

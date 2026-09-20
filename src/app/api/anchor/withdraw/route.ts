import { NextResponse } from "next/server";
import { startWithdraw } from "@/lib/stellar/anchor";
import { bearer, fail } from "../_shared";

/**
 * Start a cash-out. Returns the treasury address and the memo the USDC
 * payment must carry for the anchor to match it to this withdrawal.
 */
export async function POST(req: Request) {
  try {
    const token = bearer(req);
    const { amount, quoteId } = (await req.json()) as {
      amount?: string;
      quoteId?: string;
    };
    return NextResponse.json(await startWithdraw(token, { amount, quoteId }));
  } catch (e) {
    return fail(e);
  }
}

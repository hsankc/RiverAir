import { NextResponse } from "next/server";
import { simulateBankTransfer } from "@/lib/stellar/anchor";
import { fail } from "../_shared";

/**
 * Sandbox only. Stands in for the customer's bank actually sending the lira,
 * which is the one leg of the ramp a testnet anchor cannot perform. On a
 * production anchor the incoming transfer triggers this and the endpoint is
 * not exposed at all — the button that calls it disappears with it.
 */
export async function POST(req: Request) {
  try {
    const { id, amount } = (await req.json()) as { id?: string; amount?: string };
    if (!id || !amount) {
      return NextResponse.json(
        { error: "A transaction id and amount are required" },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, result: await simulateBankTransfer(id, amount) });
  } catch (e) {
    return fail(e);
  }
}

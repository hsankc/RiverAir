import { NextResponse } from "next/server";
import { startDeposit } from "@/lib/stellar/anchor";
import { bearer, fail } from "../_shared";

/** Start a lira deposit. Returns the IBAN and reference to pay against. */
export async function POST(req: Request) {
  try {
    const token = bearer(req);
    const { account, amount, quoteId } = (await req.json()) as {
      account?: string;
      amount?: string;
      quoteId?: string;
    };
    if (!account) {
      return NextResponse.json({ error: "A Stellar account is required" }, { status: 400 });
    }
    return NextResponse.json(await startDeposit(token, { account, amount, quoteId }));
  } catch (e) {
    return fail(e);
  }
}

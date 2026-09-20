import { NextResponse } from "next/server";
import { getChallenge } from "@/lib/stellar/anchor";
import { fail } from "../_shared";

/** SEP-10 step one: hand the wallet a challenge transaction to sign. */
export async function POST(req: Request) {
  try {
    const { account } = (await req.json()) as { account?: string };
    if (!account || !/^G[A-Z2-7]{55}$/.test(account)) {
      return NextResponse.json({ error: "A Stellar account is required" }, { status: 400 });
    }
    return NextResponse.json(await getChallenge(account));
  } catch (e) {
    return fail(e);
  }
}

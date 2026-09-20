import { NextResponse } from "next/server";
import { createQuote, TRY_ASSET, tryPerUsdc, usdcAsset } from "@/lib/stellar/anchor";
import { USDC } from "@/lib/stellar/config";
import { bearer, fail } from "../_shared";

/**
 * Firm SEP-38 quote. The rate is held until `expires_at`, and its id is what
 * ties the USDC sitting in escrow back to the lira figure the customer agreed
 * to — the escrow records both.
 */
export async function POST(req: Request) {
  try {
    const token = bearer(req);
    const { tryAmount, usdcAmount, direction } = (await req.json()) as {
      tryAmount?: string;
      usdcAmount?: string;
      direction?: "buy" | "sell";
    };

    const sellingUsdc = direction === "sell";
    const quote =
      sellingUsdc
        ? await createQuote(token, {
            sellAsset: usdcAsset(USDC.issuer),
            buyAsset: TRY_ASSET,
            sellAmount: usdcAmount,
          })
        : await createQuote(token, {
            sellAsset: TRY_ASSET,
            buyAsset: usdcAsset(USDC.issuer),
            sellAmount: tryAmount,
          });

    return NextResponse.json({ ...quote, rate: tryPerUsdc(quote, !sellingUsdc) });
  } catch (e) {
    return fail(e);
  }
}

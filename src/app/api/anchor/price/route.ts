import { NextResponse } from "next/server";
import { getPrice, TRY_ASSET, tryPerUsdc, usdcAsset } from "@/lib/stellar/anchor";
import { USDC } from "@/lib/stellar/config";
import { fail } from "../_shared";

/**
 * Indicative TRY → USDC rate, used to price a mission while the customer is
 * still typing. No session needed; nothing is committed. The firm rate comes
 * from `/api/anchor/quote` at the moment the escrow is funded.
 */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const tryAmount = params.get("try") ?? "1000";
    const direction = params.get("direction") ?? "buy";

    const sellingUsdc = direction === "sell";
    const price =
      sellingUsdc
        ? await getPrice({
            sellAsset: usdcAsset(USDC.issuer),
            buyAsset: TRY_ASSET,
            sellAmount: params.get("usdc") ?? "10",
          })
        : await getPrice({
            sellAsset: TRY_ASSET,
            buyAsset: usdcAsset(USDC.issuer),
            sellAmount: tryAmount,
          });

    // `rate` is always lira per USDC, so callers never have to think about
    // which way the quote was asked. The raw SEP-38 fields ride along.
    return NextResponse.json({ ...price, rate: tryPerUsdc(price, !sellingUsdc) });
  } catch (e) {
    return fail(e);
  }
}

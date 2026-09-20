import { NextResponse } from "next/server";
import { getToml } from "@/lib/stellar/anchor";
import { ANCHOR } from "@/lib/stellar/config";
import { fail } from "../_shared";

/**
 * What SEP-1 discovery actually returned. Surfaced so the UI can show that the
 * endpoints were read off the anchor rather than compiled into the app — swap
 * the home domain and these values change with it.
 */
export async function GET() {
  try {
    const toml = await getToml();
    return NextResponse.json({
      homeDomain: ANCHOR.homeDomain,
      endpoints: {
        auth: toml.WEB_AUTH_ENDPOINT,
        transfer: toml.TRANSFER_SERVER,
        kyc: toml.KYC_SERVER ?? null,
        quotes: toml.ANCHOR_QUOTE_SERVER ?? null,
      },
      signingKey: toml.SIGNING_KEY,
      networkPassphrase: toml.NETWORK_PASSPHRASE,
      currencies: toml.currencies,
    });
  } catch (e) {
    return fail(e);
  }
}

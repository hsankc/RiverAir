import { NextResponse } from "next/server";
import { getTransaction, listTransactions } from "@/lib/stellar/anchor";
import { bearer, fail } from "../_shared";

/** Poll one ramp transaction, or list them all when no id is given. */
export async function GET(req: Request) {
  try {
    const token = bearer(req);
    const id = new URL(req.url).searchParams.get("id");
    return NextResponse.json(
      id ? await getTransaction(token, id) : await listTransactions(token),
    );
  } catch (e) {
    return fail(e);
  }
}

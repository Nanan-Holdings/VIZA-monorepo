import { NextResponse } from "next/server";
import {
  requestAccountDeletion,
  revokeAccountDeletion,
} from "@/app/actions/account";
import { AccountRateLimitError } from "@/lib/account/errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    let body: { revoke?: boolean } = {};
    try {
      body = (await req.json()) as { revoke?: boolean };
    } catch {
      // empty body — treat as request
    }
    const status = body.revoke
      ? await revokeAccountDeletion()
      : await requestAccountDeletion();
    return NextResponse.json(status, { status: 200 });
  } catch (err) {
    if (err instanceof AccountRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    const message = err instanceof Error ? err.message : "Deletion failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

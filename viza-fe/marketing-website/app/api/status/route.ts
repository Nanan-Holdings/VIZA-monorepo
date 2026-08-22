import { NextResponse } from "next/server";
import { getPublicStatusSnapshot } from "@/lib/public-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getPublicStatusSnapshot({ noStore: true });
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
    },
  });
}

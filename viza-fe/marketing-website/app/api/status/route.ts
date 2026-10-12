import { NextResponse } from "next/server";
import { getPublicStatusResult } from "@/lib/public-status";
import { publicStatusHttpStatus } from "@/lib/public-status-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getPublicStatusResult({ noStore: true });
  return NextResponse.json(result.snapshot, {
    status: publicStatusHttpStatus(result.ready),
    headers: {
      "Cache-Control": result.ready ? "public, max-age=30, stale-while-revalidate=120" : "no-store",
      "X-Viza-Status-Readiness": result.reason,
    },
  });
}

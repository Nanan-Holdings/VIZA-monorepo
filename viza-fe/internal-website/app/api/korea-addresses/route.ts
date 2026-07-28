import { NextResponse } from "next/server";
import { searchKoreaAddresses } from "@/lib/korea-address-search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const keyword = url.searchParams.get("keyword")?.trim() ?? "";
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;

  if (keyword.length < 2) {
    return NextResponse.json({ totalCount: 0, options: [] });
  }

  try {
    const result = await searchKoreaAddresses(keyword, { limit });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Korea address search failed";
    return NextResponse.json({ error: message, totalCount: 0, options: [] }, { status: 502 });
  }
}

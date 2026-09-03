import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function matchesSecret(provided: string, expected: string) {
  const left = Buffer.from(provided); const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const expected = process.env.REVALIDATE_SECRET?.trim();
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!expected || !provided || !matchesSecret(provided, expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { slug?: unknown; locale?: unknown } | null;
  const slug = typeof body?.slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) ? body.slug : null;
  const locale = body?.locale === "zh-CN" ? "zh-CN" : "en";
  revalidatePath("/blog"); revalidatePath("/zh-CN/blog");
  if (slug) revalidatePath(locale === "en" ? `/blog/${slug}` : `/zh-CN/blog/${slug}`);
  return NextResponse.json({ revalidated: true });
}

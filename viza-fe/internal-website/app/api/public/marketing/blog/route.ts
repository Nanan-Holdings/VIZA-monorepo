import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asMarketingDb, recordArray } from "@/lib/marketing/db";
import { toPublicBlogFeed } from "@/lib/marketing/public-blog";
import { isMarketingBlogLocale } from "@/lib/marketing/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "en";
  if (!isMarketingBlogLocale(locale)) return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  const db = asMarketingDb(createAdminClient());
  const { data, error } = await db.from("marketing_blog_posts")
    .select("id, locale, slug, title, excerpt, cover_image_url, category, author_name, published_at")
    .eq("locale", locale).eq("status", "published").order("published_at", { ascending: false }).limit(100);
  if (error) {
    console.error("[public-marketing-blog-feed]", error.message);
    return NextResponse.json({ error: "Blog feed unavailable" }, { status: 503 });
  }
  return NextResponse.json(toPublicBlogFeed(recordArray(data)), {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
  });
}

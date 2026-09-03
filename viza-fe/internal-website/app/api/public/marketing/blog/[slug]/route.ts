import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asMarketingDb } from "@/lib/marketing/db";
import { toPublicBlogPost } from "@/lib/marketing/public-blog";
import { isMarketingBlogLocale } from "@/lib/marketing/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "en";
  if (!isMarketingBlogLocale(locale)) return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  const { slug } = await context.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  const db = asMarketingDb(createAdminClient());
  const { data, error } = await db.from("marketing_blog_posts").select("id, locale, slug, title, excerpt, body_markdown, cover_image_url, category, author_name, seo_title, seo_description, published_at, updated_at").eq("locale", locale).eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) {
    console.error("[public-marketing-blog-detail]", error.message);
    return NextResponse.json({ error: "Blog post unavailable" }, { status: 503 });
  }
  if (!data) return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
  return NextResponse.json(toPublicBlogPost(data), {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
  });
}

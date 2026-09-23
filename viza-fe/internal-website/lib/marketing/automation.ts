import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";
import { mapBlogAdminRecord, mapSocialComposition } from "./db";
import { completeMarketingJson, contentGenerationReadiness, generateBlogDraft, generateSocialCopy } from "./providers/openrouter";
import { getZernioPost, zernioPlatformPostUrl } from "./providers/zernio";
import { checkUploadPostJob } from "./providers/upload-post";
import { buildGroundedDraftBrief, MIN_ARTICLE_CHARS, rankNewsStories, readNewsStory, scanNews } from "./news-pipeline";
import { rehostMarketingCover } from "./cover";
import { measuredKeyword, measuredKeywords } from "./seo-keywords";
import { normalizeMarketingSlug, validateBlogDraft } from "./validation";
import type { MarketingBlogAdminRecord, MarketingBlogLocale, MarketingSocialPlatform } from "./contracts";
import pipelineConfig from "@/scripts/pipeline.config.json";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function automationConfig() {
  const actorId = process.env.VIZA_MARKETING_AUTOMATION_ACTOR_ID?.trim();
  const localeValue = process.env.VIZA_MARKETING_AUTOMATION_LOCALE?.trim() || "en";
  if (!actorId || !UUID.test(actorId)) throw new Error("VIZA_MARKETING_AUTOMATION_ACTOR_ID is not configured");
  if (localeValue !== "en" && localeValue !== "zh-CN") throw new Error("VIZA_MARKETING_AUTOMATION_LOCALE is invalid");
  return { actorId, locale: localeValue as MarketingBlogLocale };
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function runScheduledBlogGeneration(now = new Date(), options?: { actorId?: string; trigger?: "manual" | "vercel-cron" }): Promise<{ skipped: boolean; post?: MarketingBlogAdminRecord }> {
  const configured = options?.actorId ? null : automationConfig();
  const actorId = options?.actorId ?? configured!.actorId;
  const localeValue = process.env.VIZA_MARKETING_AUTOMATION_LOCALE?.trim() || pipelineConfig.content.locale;
  if (localeValue !== "en" && localeValue !== "zh-CN") throw new Error("VIZA_MARKETING_AUTOMATION_LOCALE is invalid");
  const locale = localeValue as MarketingBlogLocale;
  const admin = createAdminClient({ requestTimeoutMs: 30_000 });
  const actor = await admin.from("users").select("id, role, deleted_at").eq("id", actorId).maybeSingle();
  if (actor.error || !actor.data || actor.data.deleted_at || actor.data.role !== "admin") throw new Error("Marketing automation actor must be an active VIZA admin");
  const trigger = options?.trigger ?? "vercel-cron";
  const idempotencyKey = trigger === "manual" ? `blog-generation:${locale}:manual:${randomUUID()}` : `blog-generation:${locale}:${dayKey(now)}`;
  const claimed = await admin.from("marketing_automation_runs").insert({ job_type: "blog_generation", idempotency_key: idempotencyKey, status: "running", actor_user_id: actorId, metadata: { locale, trigger } }).select("id").single();
  if (claimed.error?.code === "23505") return { skipped: true };
  if (claimed.error || !claimed.data) throw new Error(claimed.error?.message ?? "Unable to claim marketing automation run");
  const runId = claimed.data.id;
  try {
    const recent = await admin.from("marketing_blog_posts").select("title, slug, status, category, updated_at").eq("locale", locale).order("updated_at", { ascending: false }).limit(60);
    if (recent.error) throw new Error(recent.error.message);
    const coveredTitles = (recent.data ?? []).map((row) => String(row.title));
    const scanned = await scanNews(pipelineConfig.news);
    if (!scanned.items.length) throw new Error("No readable news feed items were found");
    const ranked = await rankNewsStories(scanned.items, {
      coveredTitles,
      relevanceRules: pipelineConfig.news.relevanceRules,
      businessDescription: pipelineConfig.business,
    }, completeMarketingJson);
    let selected: { ranked: (typeof ranked)[number]; article: Awaited<ReturnType<typeof readNewsStory>> } | null = null;
    for (const candidate of ranked.filter((item) => item.score >= pipelineConfig.content.minimumRankScore).slice(0, 8)) {
      const article = await readNewsStory(candidate.story);
      if (article.text.length >= MIN_ARTICLE_CHARS) { selected = { ranked: candidate, article }; break; }
    }
    if (!selected) throw new Error("No ranked story had enough readable source text to ground a draft");
    const sourceBrief = buildGroundedDraftBrief(selected.ranked.story, selected.article, locale);
    const keywordOptions = measuredKeywords().slice(0, 40);
    const generated = await generateBlogDraft(locale, `${sourceBrief}\n\nVIZA business: ${pipelineConfig.business}\nVoice: ${pipelineConfig.voice.join(" ")}\nAllowed categories: ${pipelineConfig.taxonomy.categories.join(", ")}.\nUseful VIZA pages, when relevant: ${pipelineConfig.moneyPages.join(", ")}.\nAvoid these existing topics: ${coveredTitles.join(" | ") || "none"}.\nMeasured keyword options, only if relevant: ${keywordOptions.map((item) => item.keyword).join(" | ") || "none supplied"}.\nReturn a category, 2-4 topics, an SEO keyword, and an SEO title. Do not invent keyword search volume.`);
    const json = generated.json;
    const slug = normalizeMarketingSlug(typeof json.slug === "string" ? json.slug : typeof json.title === "string" ? json.title : "");
    const category = typeof json.category === "string" && pipelineConfig.taxonomy.categories.includes(json.category) ? json.category : pipelineConfig.taxonomy.categories[0];
    const clean = validateBlogDraft({ locale, slug, title: String(json.title ?? ""), excerpt: String(json.excerpt ?? ""), bodyMarkdown: String(json.bodyMarkdown ?? ""), category, authorName: pipelineConfig.content.author, seoTitle: typeof json.seoTitle === "string" ? json.seoTitle : String(json.title ?? ""), seoDescription: typeof json.seoDescription === "string" ? json.seoDescription : undefined, reason: `News pipeline ${idempotencyKey}` });
    if (!clean.bodyMarkdown.includes(selected.article.url)) throw new Error("Draft omitted its source URL");
    if (pipelineConfig.validation.reservedSlugs.includes(clean.slug)) throw new Error("Draft used a reserved slug");
    const collision = await admin.from("marketing_blog_posts").select("id").eq("locale", locale).eq("slug", clean.slug).maybeSingle();
    if (collision.error) throw new Error(collision.error.message);
    if (collision.data) throw new Error("Draft slug already exists");
    const coverImageUrl = await rehostMarketingCover(selected.article.coverImageUrl);
    const topics = Array.isArray(json.topics) ? json.topics.filter((topic): topic is string => typeof topic === "string").slice(0, 4) : [];
    const seoKeyword = typeof json.seoKeyword === "string" ? json.seoKeyword.slice(0, 120) : null;
    const keywordRecord = seoKeyword ? measuredKeyword(seoKeyword) : null;
    const inserted = await admin.from("marketing_blog_posts").insert({ locale: clean.locale, slug: clean.slug, status: "draft", title: clean.title, excerpt: clean.excerpt, body_markdown: clean.bodyMarkdown, cover_image_url: coverImageUrl, category: clean.category ?? null, author_name: clean.authorName, seo_title: clean.seoTitle ?? null, seo_description: clean.seoDescription ?? null, generation_brief: sourceBrief.slice(0, 4_000), generated_by_model: generated.model, metadata: { automation_run_id: runId, idempotency_key: idempotencyKey, source_url: selected.article.url, source_publisher: selected.ranked.story.source, source_rank_score: selected.ranked.score, source_rank_reason: selected.ranked.reason, feed_errors: scanned.feedErrors, topics, seo_keyword: seoKeyword, keyword_measured: Boolean(keywordRecord), keyword_monthly_searches: keywordRecord?.averageMonthlySearches ?? null }, created_by: actorId, updated_by: actorId }).select("*").single();
    if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Unable to save scheduled blog draft");
    const post = mapBlogAdminRecord(inserted.data);
    let socialError: string | null = null;
    try {
      const platforms = pipelineConfig.content.platforms as MarketingSocialPlatform[];
      const destinationUrl = new URL(`/blog/${post.slug}`, process.env.VIZA_MARKETING_PUBLIC_BASE_URL ?? "https://viza.it.com").toString();
      const captions = await generateSocialCopy({ brief: `Promote this reviewed VIZA draft accurately. Title: ${post.title}. Excerpt: ${post.excerpt}. Source: ${selected.article.url}. Use {url} as the link placeholder.`, platforms, destinationUrl });
      const raw = captions.json.platformContent;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Caption model returned no platform content");
      const platformContent = Object.fromEntries(platforms.map((platform) => [platform, String((raw as Record<string, unknown>)[platform] ?? "").trim()]));
      if (Object.values(platformContent).some((caption) => !caption)) throw new Error("Caption model omitted a platform");
      const social = await admin.from("marketing_social_compositions").insert({ blog_post_id: post.id, title: `Promote: ${post.title}`, brief: `Generated from ${selected.article.url}`, destination_url: destinationUrl, media_url: coverImageUrl, status: "draft", platforms, platform_content: platformContent, created_by: actorId, updated_by: actorId }).select("id").single();
      if (social.error) throw new Error(social.error.message);
    } catch (error) { socialError = error instanceof Error ? error.message : "Caption generation failed"; }
    await admin.from("marketing_automation_runs").update({ status: "succeeded", output_entity_type: "marketing_blog_post", output_entity_id: post.id, completed_at: new Date().toISOString(), heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString(), metadata: { locale, trigger, model: generated.model, slug: post.slug, social_error: socialError } }).eq("id", runId);
    await admin.from("marketing_provider_activity").insert({ provider: generated.provider, operation: "blog.generate.scheduled", status: "succeeded", entity_type: "marketing_blog_post", entity_id: post.id, actor_user_id: actorId, request_metadata: { reason: "Scheduled generation", idempotencyKey }, response_metadata: { model: generated.model, outputLength: post.bodyMarkdown.length } });
    return { skipped: false, post };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled blog generation failed";
    await admin.from("marketing_automation_runs").update({ status: "failed", error_message: message.slice(0, 1000), completed_at: new Date().toISOString(), heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", runId);
    await admin.from("marketing_provider_activity").insert({ provider: contentGenerationReadiness().provider ?? "system", operation: "blog.generate.scheduled", status: "failed", actor_user_id: actorId, request_metadata: { reason: "Scheduled generation", idempotencyKey }, response_metadata: {}, error_code: error instanceof Error ? error.name.slice(0, 100) : null, error_message: message.slice(0, 500) });
    throw error;
  }
}

export async function failStuckMarketingRuns(now = new Date()) {
  const admin = createAdminClient({ requestTimeoutMs: 30_000 });
  const cutoff = new Date(now.getTime() - 20 * 60_000).toISOString();
  const stuck = await admin.from("marketing_automation_runs").select("id, job_type, idempotency_key").eq("status", "running").lt("heartbeat_at", cutoff);
  if (stuck.error) throw new Error(stuck.error.message);
  const ids = (stuck.data ?? []).map((run) => run.id);
  if (ids.length) {
    const updated = await admin.from("marketing_automation_runs").update({ status: "failed", error_message: "Run exceeded the 20-minute heartbeat window", completed_at: now.toISOString(), updated_at: now.toISOString() }).in("id", ids);
    if (updated.error) throw new Error(updated.error.message);
  }
  return { failedRunCount: ids.length };
}

export async function runSocialReconciliation(now = new Date()) {
  const { actorId } = automationConfig(); const admin = createAdminClient({ requestTimeoutMs: 30_000 });
  const bucket = now.toISOString().slice(0, 13); const idempotencyKey = `social-reconcile:${bucket}`;
  const claimed = await admin.from("marketing_automation_runs").insert({ job_type: "social_reconcile", idempotency_key: idempotencyKey, status: "running", actor_user_id: actorId, metadata: { trigger: "vercel-cron" } }).select("id").single();
  if (claimed.error?.code === "23505") return { skipped: true, reconciled: 0, failed: 0 };
  if (claimed.error || !claimed.data) throw new Error(claimed.error?.message ?? "Unable to claim social reconciliation run");
  const runId = claimed.data.id;
  try {
    const rows = await admin.from("marketing_social_compositions").select("*").in("status", ["scheduled", "publishing", "published", "partial"]).order("updated_at", { ascending: true }).limit(100);
    if (rows.error) throw new Error(rows.error.message);
    let reconciled = 0; let failed = 0;
    for (const value of rows.data ?? []) {
      const composition = mapSocialComposition(value); const entries = Object.entries(composition.zernioPosts).filter((entry): entry is [MarketingSocialPlatform, string] => Boolean(entry[1])); const ids = entries.map((entry) => entry[1]);
      if (!ids.length && !Object.keys(composition.uploadPostPosts).length) { failed += 1; continue; }
      try {
        const posts = await Promise.all(ids.map(getZernioPost));
        const statuses = posts.map((body) => { const post = body.post && typeof body.post === "object" && !Array.isArray(body.post) ? body.post as Record<string, unknown> : body; return typeof post.status === "string" ? post.status : "publishing"; });
        const zernioPostUrls = { ...composition.zernioPostUrls };
        posts.forEach((body, index) => { const url = zernioPlatformPostUrl(body, entries[index][0]); if (url) zernioPostUrls[entries[index][0]] = url; });
        const uploadPosts = { ...composition.uploadPostPosts };
        for (const platform of ["instagram", "pinterest"] as const) {
          const item = uploadPosts[platform];
          if (!item || item.status !== "pending" || !item.requestId) continue;
          const checked = await checkUploadPostJob(item.requestId, platform);
          uploadPosts[platform] = { status: checked.status, requestId: checked.requestId, postId: checked.postId, postUrl: checked.postUrl };
        }
        const allStatuses = [...statuses, ...Object.values(uploadPosts).map((item) => item.status)];
        const status = allStatuses.every((item) => item === "published") ? "published" : allStatuses.some((item) => item === "failed") ? (allStatuses.some((item) => item === "published") ? "partial" : "failed") : allStatuses.every((item) => item === "scheduled") ? "scheduled" : "publishing";
        const updated = await admin.from("marketing_social_compositions").update({ status, upload_post_posts: uploadPosts, zernio_post_urls: zernioPostUrls, last_synced_at: now.toISOString(), updated_at: now.toISOString(), updated_by: actorId }).eq("id", composition.id);
        if (updated.error) throw new Error(updated.error.message);
        reconciled += 1;
      } catch { failed += 1; }
    }
    await admin.from("marketing_automation_runs").update({ status: failed ? "failed" : "succeeded", error_message: failed ? `${failed} composition(s) could not be reconciled` : null, completed_at: now.toISOString(), heartbeat_at: now.toISOString(), updated_at: now.toISOString(), metadata: { trigger: "vercel-cron", reconciled, failed } }).eq("id", runId);
    return { skipped: false, reconciled, failed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Social reconciliation failed";
    await admin.from("marketing_automation_runs").update({ status: "failed", error_message: message.slice(0, 1000), completed_at: now.toISOString(), heartbeat_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", runId);
    throw error;
  }
}

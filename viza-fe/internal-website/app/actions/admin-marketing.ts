"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MARKETING_SOCIAL_PLATFORMS,
  type MarketingActionResult,
  type MarketingBlogAdminRecord,
  type MarketingBlogDraftInput,
  type MarketingBlogLocale,
  type MarketingOperationsDashboard,
  type MarketingProviderReadiness,
  type MarketingShortLinkRecord,
  type MarketingSocialCompositionInput,
  type MarketingSocialCompositionRecord,
  type MarketingSocialPlatform,
} from "@/lib/marketing/contracts";
import { asMarketingDb, mapAutomationRun, mapBlogAdminRecord, mapShortLink, mapSocialComposition, recordArray } from "@/lib/marketing/db";
import { fetchAnalyticsOverview, googleReadiness } from "@/lib/marketing/providers/google";
import { generateBlogDraft as openRouterBlog, generateSocialCopy } from "@/lib/marketing/providers/openrouter";
import { cancelZernioSchedule, createZernioPosts, deleteZernioPost, fetchZernioAnalytics, findZernioCompositionPosts, getZernioPost, unpublishZernioPost, ZERNIO_ACCOUNT_ENV_NAMES } from "@/lib/marketing/providers/zernio";
import { normalizeMarketingSlug, validateBlogDraft, validateSocialComposition } from "@/lib/marketing/validation";
import { revalidatePublicMarketingBlog } from "@/lib/marketing/revalidate";

type Actor = Awaited<ReturnType<typeof requireRole>>;

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function context() {
  const actor = await requireRole("admin");
  return { actor, db: asMarketingDb(createAdminClient()) };
}

async function activity(
  db: ReturnType<typeof asMarketingDb>, actor: Actor, input: {
    provider: "openrouter" | "zernio" | "google-analytics" | "search-console" | "system";
    operation: string; status: "started" | "succeeded" | "failed" | "skipped";
    entityType?: string; entityId?: string; reason?: string; request?: Record<string, unknown>;
    response?: Record<string, unknown>; error?: unknown;
  },
) {
  const errorText = input.error ? message(input.error, "Provider operation failed").slice(0, 500) : null;
  await db.from("marketing_provider_activity").insert({
    provider: input.provider, operation: input.operation, status: input.status,
    entity_type: input.entityType ?? null, entity_id: input.entityId ?? null, actor_user_id: actor.id,
    request_metadata: { reason: input.reason?.trim().slice(0, 500) ?? null, ...(input.request ?? {}) },
    response_metadata: input.response ?? {}, error_code: input.error instanceof Error ? input.error.name.slice(0, 100) : null,
    error_message: errorText,
  });
}

function providerReadiness(): MarketingProviderReadiness {
  const configuredPlatforms = MARKETING_SOCIAL_PLATFORMS.filter((platform) => {
    if (!process.env[ZERNIO_ACCOUNT_ENV_NAMES[platform]]?.trim()) return false;
    if (platform === "pinterest" && !process.env.ZERNIO_PINTEREST_BOARD_ID?.trim()) return false;
    if (platform === "reddit" && !process.env.ZERNIO_REDDIT_SUBREDDIT?.trim()) return false;
    return true;
  });
  const google = googleReadiness();
  return {
    openrouter: { connected: Boolean(process.env.OPENROUTER_API_KEY?.trim() && process.env.VIZA_MARKETING_OPENROUTER_MODEL?.trim()), model: process.env.VIZA_MARKETING_OPENROUTER_MODEL?.trim() || null },
    zernio: {
      connected: Boolean(process.env.ZERNIO_API_KEY?.trim() && process.env.ZERNIO_TIMEZONE?.trim() && configuredPlatforms.length),
      configuredPlatforms, missingPlatforms: MARKETING_SOCIAL_PLATFORMS.filter((platform) => !configuredPlatforms.includes(platform)),
    },
    ga4: { connected: google.ga4 }, searchConsole: { connected: google.searchConsole },
  };
}

function publicMarketingBaseUrl(): URL {
  const raw = process.env.VIZA_MARKETING_PUBLIC_BASE_URL?.trim();
  if (!raw) throw new Error("VIZA_MARKETING_PUBLIC_BASE_URL is not configured");
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error("VIZA_MARKETING_PUBLIC_BASE_URL must use HTTPS");
  return url;
}

async function createShortLink(db: ReturnType<typeof asMarketingDb>, actor: Actor, input: { destinationUrl: string; campaign: string; contentKey?: string }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = randomBytes(6).toString("base64url");
    const result = await db.from("marketing_short_links").insert({ code, destination_url: input.destinationUrl, source: "social", campaign: input.campaign.slice(0, 200), content_key: input.contentKey?.slice(0, 200) ?? null, active: true, created_by: actor.id }).select("*").single();
    if (!result.error && result.data) return mapShortLink(result.data);
    if (result.error?.code !== "23505") throw new Error(result.error?.message ?? "Unable to create short link");
  }
  throw new Error("Unable to allocate a unique short link");
}

export async function listMarketingShortLinks(): Promise<MarketingShortLinkRecord[]> {
  const { db } = await context();
  const { data, error } = await db.from("marketing_short_links").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return recordArray(data).map(mapShortLink);
}

export async function setMarketingShortLinkActive(input: { id: string; active: boolean; reason: string }): Promise<MarketingActionResult<MarketingShortLinkRecord>> {
  try {
    const { actor, db } = await context();
    if (actor.role !== "admin") return { success: false, error: "Admin privileges required to change redirects" };
    const reason = input.reason.trim(); if (reason.length < 5) return { success: false, error: "Reason must be at least 5 characters" };
    const result = await db.from("marketing_short_links").update({ active: input.active }).eq("id", input.id).select("*").single();
    if (result.error || !result.data) return { success: false, error: result.error?.message ?? "Short link not found" };
    const saved = mapShortLink(result.data);
    await activity(db, actor, { provider: "system", operation: input.active ? "short-link.activate" : "short-link.deactivate", status: "succeeded", entityType: "marketing_short_link", entityId: saved.id, reason });
    revalidatePath("/admin/marketing/tracking"); return { success: true, data: saved };
  } catch (error) { return { success: false, error: message(error, "Unable to update short link") }; }
}

export async function createMarketingShortLink(input: { destinationUrl: string; campaign: string; contentKey?: string; reason: string }): Promise<MarketingActionResult<MarketingShortLinkRecord & { shortUrl: string }>> {
  try {
    const { actor, db } = await context();
    const destinationUrl = new URL(input.destinationUrl.trim());
    if (destinationUrl.protocol !== "https:") return { success: false, error: "Destination must use HTTPS" };
    const campaign = input.campaign.trim(); const reason = input.reason.trim();
    if (!campaign || reason.length < 5) return { success: false, error: "Campaign and an operational reason are required" };
    const saved = await createShortLink(db, actor, { destinationUrl: destinationUrl.toString(), campaign, contentKey: input.contentKey });
    const shortUrl = new URL(`/s/${saved.code}`, publicMarketingBaseUrl()).toString();
    await activity(db, actor, { provider: "system", operation: "short-link.create", status: "succeeded", entityType: "marketing_short_link", entityId: saved.id, reason, request: { campaign: campaign.slice(0, 200) } });
    revalidatePath("/admin/marketing/tracking"); return { success: true, data: { ...saved, shortUrl } };
  } catch (error) { return { success: false, error: message(error, "Unable to create short link") }; }
}

export async function listMarketingBlogPosts(): Promise<MarketingBlogAdminRecord[]> {
  const { db } = await context();
  const { data, error } = await db.from("marketing_blog_posts").select("*").order("updated_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return recordArray(data).map(mapBlogAdminRecord);
}

export async function getMarketingBlogPostAdmin(id: string): Promise<MarketingBlogAdminRecord | null> {
  const { db } = await context();
  const { data, error } = await db.from("marketing_blog_posts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapBlogAdminRecord(data) : null;
}

export async function saveMarketingBlogDraft(input: MarketingBlogDraftInput): Promise<MarketingActionResult<MarketingBlogAdminRecord>> {
  try {
    const { actor, db } = await context();
    const clean = validateBlogDraft(input); const now = new Date().toISOString();
    let result;
    if (clean.id) {
      const current = await db.from("marketing_blog_posts").select("status, version").eq("id", clean.id).maybeSingle();
      if (current.error || !current.data) return { success: false, error: current.error?.message ?? "Blog post not found" };
      const row = current.data as Record<string, unknown>;
      if (row.status !== "draft" && actor.role !== "admin") return { success: false, error: "Admin privileges required to edit published or archived posts" };
      const currentVersion = typeof row.version === "number" ? row.version : 1;
      if (input.expectedVersion !== undefined && input.expectedVersion !== currentVersion) {
        return { success: false, error: "This article changed after you opened it. Reload before saving." };
      }
      result = await db.from("marketing_blog_posts").update({
        locale: clean.locale, slug: clean.slug, title: clean.title, excerpt: clean.excerpt, body_markdown: clean.bodyMarkdown,
        cover_image_url: clean.coverImageUrl ?? null, category: clean.category ?? null, author_name: clean.authorName,
        seo_title: clean.seoTitle ?? null, seo_description: clean.seoDescription ?? null,
        updated_by: actor.id, updated_at: now, version: currentVersion + 1,
        metadata: { last_change_reason: clean.reason },
      }).eq("id", clean.id).eq("version", currentVersion).select("*").maybeSingle();
      if (!result.error && !result.data) return { success: false, error: "This article changed while you were saving. Reload and try again." };
    } else {
      result = await db.from("marketing_blog_posts").insert({
        locale: clean.locale, slug: clean.slug, status: "draft", title: clean.title, excerpt: clean.excerpt,
        body_markdown: clean.bodyMarkdown, cover_image_url: clean.coverImageUrl ?? null, category: clean.category ?? null,
        author_name: clean.authorName, seo_title: clean.seoTitle ?? null, seo_description: clean.seoDescription ?? null,
        metadata: { create_reason: clean.reason }, created_by: actor.id, updated_by: actor.id, created_at: now, updated_at: now,
      }).select("*").single();
    }
    if (result.error || !result.data) return { success: false, error: result.error?.message ?? "Unable to save blog draft" };
    const saved = mapBlogAdminRecord(result.data);
    await activity(db, actor, { provider: "system", operation: clean.id ? "blog.update" : "blog.create", status: "succeeded", entityType: "marketing_blog_post", entityId: saved.id, reason: clean.reason, request: { locale: clean.locale, slug: clean.slug } });
    if (saved.status === "published") await revalidatePublicMarketingBlog({ locale: saved.locale, slug: saved.slug }).catch(async (error) => { await activity(db, actor, { provider: "system", operation: "blog.revalidate", status: "failed", entityType: "marketing_blog_post", entityId: saved.id, reason: clean.reason, error }); });
    revalidatePath("/admin/marketing"); return { success: true, data: saved };
  } catch (error) { return { success: false, error: message(error, "Unable to save blog draft") }; }
}

async function changeBlogStatus(input: { id: string; reason: string }, status: "published" | "archived"): Promise<MarketingActionResult<MarketingBlogAdminRecord>> {
  try {
    const { actor, db } = await context();
    if (actor.role !== "admin") return { success: false, error: "Admin privileges required to change public visibility" };
    const reason = input.reason.trim(); if (!reason) return { success: false, error: "Reason is required" };
    const now = new Date().toISOString();
    const changes: Record<string, unknown> = { status, updated_by: actor.id, updated_at: now, metadata: { status_change_reason: reason } };
    if (status === "published") Object.assign(changes, { published_by: actor.id, published_at: now });
    const { data, error } = await db.from("marketing_blog_posts").update(changes).eq("id", input.id).select("*").single();
    if (error || !data) return { success: false, error: error?.message ?? "Blog post not found" };
    const saved = mapBlogAdminRecord(data);
    await activity(db, actor, { provider: "system", operation: `blog.${status}`, status: "succeeded", entityType: "marketing_blog_post", entityId: saved.id, reason });
    await revalidatePublicMarketingBlog({ locale: saved.locale, slug: saved.slug }).catch(async (error) => { await activity(db, actor, { provider: "system", operation: "blog.revalidate", status: "failed", entityType: "marketing_blog_post", entityId: saved.id, reason, error }); });
    revalidatePath("/admin/marketing"); return { success: true, data: saved };
  } catch (error) { return { success: false, error: message(error, `Unable to ${status} blog post`) }; }
}

export async function publishMarketingBlogPost(input: { id: string; reason: string }) {
  return changeBlogStatus(input, "published");
}

export async function archiveMarketingBlogPost(input: { id: string; reason: string }) {
  return changeBlogStatus(input, "archived");
}

export async function generateMarketingBlogDraft(input: { brief: string; locale: MarketingBlogLocale; reason: string }): Promise<MarketingActionResult<MarketingBlogAdminRecord>> {
  let auditContext: Awaited<ReturnType<typeof context>> | null = null;
  try {
    auditContext = await context(); const brief = input.brief.trim(); const reason = input.reason.trim();
    if (!brief || !reason) return { success: false, error: "Brief and reason are required" };
    const generated = await openRouterBlog(input.locale, brief);
    const json = generated.json; const slug = normalizeMarketingSlug(typeof json.slug === "string" ? json.slug : typeof json.title === "string" ? json.title : "");
    const clean = validateBlogDraft({ locale: input.locale, slug, title: String(json.title ?? ""), excerpt: String(json.excerpt ?? ""), bodyMarkdown: String(json.bodyMarkdown ?? ""), category: typeof json.category === "string" ? json.category : undefined, authorName: "VIZA Editorial", seoTitle: typeof json.seoTitle === "string" ? json.seoTitle : undefined, seoDescription: typeof json.seoDescription === "string" ? json.seoDescription : undefined, reason });
    const now = new Date().toISOString();
    const { data, error } = await auditContext.db.from("marketing_blog_posts").insert({
      locale: clean.locale, slug: clean.slug, status: "draft", title: clean.title, excerpt: clean.excerpt,
      body_markdown: clean.bodyMarkdown, category: clean.category ?? null, author_name: clean.authorName,
      seo_title: clean.seoTitle ?? null, seo_description: clean.seoDescription ?? null, generation_brief: brief,
      generated_by_model: generated.model, metadata: { generation_reason: reason }, created_by: auditContext.actor.id,
      updated_by: auditContext.actor.id, created_at: now, updated_at: now,
    }).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "Unable to persist generated draft");
    const saved = mapBlogAdminRecord(data);
    await activity(auditContext.db, auditContext.actor, { provider: "openrouter", operation: "blog.generate", status: "succeeded", entityType: "marketing_blog_post", entityId: saved.id, reason, request: { locale: input.locale, briefLength: brief.length }, response: { model: generated.model, outputLength: clean.bodyMarkdown.length } });
    revalidatePath("/admin/marketing"); return { success: true, data: saved };
  } catch (error) {
    if (auditContext) await activity(auditContext.db, auditContext.actor, { provider: "openrouter", operation: "blog.generate", status: "failed", reason: input.reason, request: { locale: input.locale, briefLength: input.brief.trim().length }, error });
    return { success: false, error: message(error, "Unable to generate blog draft") };
  }
}

export async function listMarketingSocialCompositions(): Promise<MarketingSocialCompositionRecord[]> {
  const { db } = await context();
  const { data, error } = await db.from("marketing_social_compositions").select("*").order("updated_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return recordArray(data).map(mapSocialComposition);
}

export async function getMarketingSocialComposition(id: string): Promise<MarketingSocialCompositionRecord | null> {
  const { db } = await context();
  const { data, error } = await db.from("marketing_social_compositions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSocialComposition(data) : null;
}

export async function saveMarketingSocialComposition(input: MarketingSocialCompositionInput): Promise<MarketingActionResult<MarketingSocialCompositionRecord>> {
  try {
    const { actor, db } = await context(); const clean = validateSocialComposition(input); const now = new Date().toISOString();
    let current: MarketingSocialCompositionRecord | null = null;
    if (clean.id) {
      const loaded = await db.from("marketing_social_compositions").select("*").eq("id", clean.id).maybeSingle();
      if (loaded.error || !loaded.data) return { success: false, error: loaded.error?.message ?? "Composition not found" };
      current = mapSocialComposition(loaded.data);
      if (["scheduled", "publishing", "published", "partial"].includes(current.status)) return { success: false, error: "Stop or cancel external posts before editing this composition" };
    }
    let shortLinkId = current?.shortLinkId ?? null;
    if (clean.trackDestination && clean.destinationUrl) {
      if (shortLinkId) {
        const updatedLink = await db.from("marketing_short_links").update({ destination_url: clean.destinationUrl, campaign: clean.title, content_key: clean.blogPostId ?? clean.id ?? null, active: true }).eq("id", shortLinkId).select("*").single();
        if (updatedLink.error) throw new Error(updatedLink.error.message);
      } else {
        shortLinkId = (await createShortLink(db, actor, { destinationUrl: clean.destinationUrl, campaign: clean.title, contentKey: clean.blogPostId ?? clean.id })).id;
      }
    } else if (shortLinkId) {
      const disabled = await db.from("marketing_short_links").update({ active: false }).eq("id", shortLinkId);
      if (disabled.error) throw new Error(disabled.error.message);
      shortLinkId = null;
    }
    const values = { blog_post_id: clean.blogPostId ?? null, short_link_id: shortLinkId, title: clean.title, brief: clean.brief, destination_url: clean.destinationUrl ?? null, media_url: clean.mediaUrl ?? null, document_url: clean.documentUrl ?? null, platforms: clean.platforms, platform_content: clean.platformContent, scheduled_for: clean.scheduledFor ?? null, status: "draft", ...(current?.status === "cancelled" ? { zernio_posts: {}, last_synced_at: null } : {}), updated_by: actor.id, updated_at: now };
    const result = clean.id
      ? await db.from("marketing_social_compositions").update(values).eq("id", clean.id).select("*").single()
      : await db.from("marketing_social_compositions").insert({ ...values, created_by: actor.id, created_at: now }).select("*").single();
    if (result.error || !result.data) return { success: false, error: result.error?.message ?? "Unable to save composition" };
    const saved = mapSocialComposition(result.data);
    await activity(db, actor, { provider: "system", operation: clean.id ? "social.update" : "social.create", status: "succeeded", entityType: "marketing_social_composition", entityId: saved.id, reason: clean.reason, request: { platforms: clean.platforms, scheduled: Boolean(clean.scheduledFor) } });
    revalidatePath("/admin/marketing"); return { success: true, data: saved };
  } catch (error) { return { success: false, error: message(error, "Unable to save composition") }; }
}

export async function generateMarketingSocialComposition(input: MarketingSocialCompositionInput): Promise<MarketingActionResult<MarketingSocialCompositionRecord>> {
  let auditContext: Awaited<ReturnType<typeof context>> | null = null;
  try {
    auditContext = await context(); const generated = await generateSocialCopy({ brief: input.brief, platforms: input.platforms, destinationUrl: input.destinationUrl });
    const raw = generated.json.platformContent;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Provider returned invalid platform content");
    const platformContent = Object.fromEntries(input.platforms.map((platform) => [platform, String((raw as Record<string, unknown>)[platform] ?? "")])) as Partial<Record<MarketingSocialPlatform, string>>;
    const saved = await saveMarketingSocialComposition({ ...input, platformContent });
    if (saved.success && saved.data) await activity(auditContext.db, auditContext.actor, { provider: "openrouter", operation: "social.generate", status: "succeeded", entityType: "marketing_social_composition", entityId: saved.data.id, reason: input.reason, request: { platforms: input.platforms, briefLength: input.brief.length }, response: { model: generated.model } });
    return saved;
  } catch (error) {
    if (auditContext) await activity(auditContext.db, auditContext.actor, { provider: "openrouter", operation: "social.generate", status: "failed", reason: input.reason, request: { platforms: input.platforms, briefLength: input.brief.length }, error });
    return { success: false, error: message(error, "Unable to generate social composition") };
  }
}

export async function publishMarketingSocialComposition(input: { id: string; reason: string }): Promise<MarketingActionResult<MarketingSocialCompositionRecord>> {
  let auditContext: Awaited<ReturnType<typeof context>> | null = null;
  try {
    auditContext = await context();
    if (auditContext.actor.role !== "admin") return { success: false, error: "Admin privileges required to publish externally" };
    const reason = input.reason.trim(); if (!reason) return { success: false, error: "Reason is required" };
    const current = await auditContext.db.from("marketing_social_compositions").select("*").eq("id", input.id).maybeSingle();
    if (current.error || !current.data) return { success: false, error: current.error?.message ?? "Composition not found" };
    const composition = mapSocialComposition(current.data);
    if (["scheduled", "publishing", "published"].includes(composition.status)) return { success: false, error: "Composition is already active in Zernio; sync it instead of publishing again" };
    const recoveredPosts = await findZernioCompositionPosts(composition.id);
    const existingPosts = { ...recoveredPosts, ...composition.zernioPosts };
    const platformsToCreate = composition.platforms.filter((platform) => !existingPosts[platform]);
    let destinationUrl = composition.destinationUrl ?? undefined;
    if (composition.shortLinkId) {
      const link = await auditContext.db.from("marketing_short_links").select("code, active").eq("id", composition.shortLinkId).maybeSingle();
      if (link.error || !link.data || typeof link.data !== "object" || Array.isArray(link.data)) throw new Error("Tracked destination is unavailable");
      const row = link.data as Record<string, unknown>;
      if (row.active !== true || typeof row.code !== "string") throw new Error("Tracked destination is inactive");
      destinationUrl = new URL(`/s/${row.code}`, publicMarketingBaseUrl()).toString();
    }
    const provider = platformsToCreate.length ? await createZernioPosts({ compositionId: composition.id, title: composition.title, platforms: platformsToCreate, platformContent: composition.platformContent, scheduledFor: composition.scheduledFor ?? undefined, publishNow: !composition.scheduledFor, destinationUrl, mediaUrl: composition.mediaUrl ?? undefined, documentUrl: composition.documentUrl ?? undefined }) : { postIds: {}, failures: [] };
    const mergedPostIds = { ...existingPosts, ...provider.postIds };
    const createdCount = Object.keys(mergedPostIds).length;
    if (!createdCount) throw new Error(provider.failures[0]?.error ?? "Zernio did not create any posts");
    const now = new Date().toISOString();
    const status = provider.failures.length ? "partial" : composition.scheduledFor ? "scheduled" : "publishing";
    const updated = await auditContext.db.from("marketing_social_compositions").update({ status, zernio_posts: mergedPostIds, updated_by: auditContext.actor.id, updated_at: now, last_synced_at: now }).eq("id", input.id).select("*").single();
    if (updated.error || !updated.data) throw new Error(updated.error?.message ?? "Unable to update composition");
    const saved = mapSocialComposition(updated.data);
    await activity(auditContext.db, auditContext.actor, { provider: "zernio", operation: composition.scheduledFor ? "social.schedule" : "social.publish", status: "succeeded", entityType: "marketing_social_composition", entityId: saved.id, reason, request: { platforms: composition.platforms, scheduled: Boolean(composition.scheduledFor) }, response: { postCount: createdCount, failureCount: provider.failures.length, failedPlatforms: provider.failures.map((failure) => failure.platform), providerStatus: status } });
    revalidatePath("/admin/marketing"); return { success: true, data: saved };
  } catch (error) {
    if (auditContext) await activity(auditContext.db, auditContext.actor, { provider: "zernio", operation: "social.publish", status: "failed", entityType: "marketing_social_composition", entityId: input.id, reason: input.reason, error });
    return { success: false, error: message(error, "Unable to publish composition") };
  }
}

export async function syncMarketingSocialComposition(input: { id: string }): Promise<MarketingActionResult<MarketingSocialCompositionRecord>> {
  let auditContext: Awaited<ReturnType<typeof context>> | null = null;
  try {
    auditContext = await context(); const current = await auditContext.db.from("marketing_social_compositions").select("*").eq("id", input.id).maybeSingle();
    if (current.error || !current.data) return { success: false, error: current.error?.message ?? "Composition not found" };
    const composition = mapSocialComposition(current.data); const ids = [...new Set(Object.values(composition.zernioPosts).filter((value): value is string => Boolean(value)))];
    if (!ids.length) return { success: false, error: "Composition has no Zernio posts to sync" };
    const responses = await Promise.all(ids.map(getZernioPost));
    const statuses = responses.map((body) => {
      const post = body.post && typeof body.post === "object" && !Array.isArray(body.post) ? body.post as Record<string, unknown> : body;
      return typeof post.status === "string" ? post.status : "publishing";
    });
    const status: MarketingSocialCompositionRecord["status"] = statuses.every((value) => value === "published") ? "published" : statuses.some((value) => value === "failed") ? "failed" : statuses.some((value) => value === "partial") ? "partial" : statuses.every((value) => value === "scheduled") ? "scheduled" : "publishing";
    const now = new Date().toISOString();
    const updated = await auditContext.db.from("marketing_social_compositions").update({ status, last_synced_at: now, updated_by: auditContext.actor.id, updated_at: now }).eq("id", input.id).select("*").single();
    if (updated.error || !updated.data) throw new Error(updated.error?.message ?? "Unable to save synced status");
    const saved = mapSocialComposition(updated.data);
    await activity(auditContext.db, auditContext.actor, { provider: "zernio", operation: "social.sync", status: "succeeded", entityType: "marketing_social_composition", entityId: saved.id, reason: "Provider status reconciliation", response: { postCount: ids.length, providerStatuses: statuses } });
    revalidatePath("/admin/marketing"); return { success: true, data: saved };
  } catch (error) {
    if (auditContext) await activity(auditContext.db, auditContext.actor, { provider: "zernio", operation: "social.sync", status: "failed", entityType: "marketing_social_composition", entityId: input.id, reason: "Provider status reconciliation", error });
    return { success: false, error: message(error, "Unable to sync composition") };
  }
}

export async function stopMarketingSocialComposition(input: { id: string; reason: string }): Promise<MarketingActionResult<MarketingSocialCompositionRecord>> {
  let auditContext: Awaited<ReturnType<typeof context>> | null = null;
  try {
    auditContext = await context();
    if (auditContext.actor.role !== "admin") return { success: false, error: "Admin privileges required to change external posts" };
    const reason = input.reason.trim(); if (reason.length < 5) return { success: false, error: "Reason must be at least 5 characters" };
    const current = await auditContext.db.from("marketing_social_compositions").select("*").eq("id", input.id).maybeSingle();
    if (current.error || !current.data) return { success: false, error: current.error?.message ?? "Composition not found" };
    const composition = mapSocialComposition(current.data);
    const entries = Object.entries(composition.zernioPosts).filter((entry): entry is [MarketingSocialPlatform, string] => Boolean(entry[1]));
    if (!entries.length) return { success: false, error: "Composition has no Zernio posts" };
    const scheduled = composition.status === "scheduled";
    const results = await Promise.all(entries.map(async ([platform, postId]) => {
      try {
        if (scheduled) {
          await cancelZernioSchedule(postId);
          await deleteZernioPost(postId);
        } else await unpublishZernioPost(postId, platform);
        return { platform, success: true } as const;
      } catch (error) {
        return { platform, success: false, error: message(error, "Provider operation failed") } as const;
      }
    }));
    const failures = results.filter((result) => !result.success);
    const status: MarketingSocialCompositionRecord["status"] = failures.length ? "partial" : scheduled ? "draft" : "cancelled";
    const now = new Date().toISOString();
    const failedPlatforms = new Set(failures.map((failure) => failure.platform));
    const remainingPosts = scheduled
      ? Object.fromEntries(entries.filter(([platform]) => failedPlatforms.has(platform)))
      : composition.zernioPosts;
    const updated = await auditContext.db.from("marketing_social_compositions").update({ status, zernio_posts: remainingPosts, scheduled_for: scheduled && !failures.length ? null : composition.scheduledFor, updated_by: auditContext.actor.id, updated_at: now, last_synced_at: now }).eq("id", input.id).select("*").single();
    if (updated.error || !updated.data) throw new Error(updated.error?.message ?? "Unable to update composition");
    const saved = mapSocialComposition(updated.data);
    await activity(auditContext.db, auditContext.actor, { provider: "zernio", operation: scheduled ? "social.unschedule" : "social.unpublish", status: failures.length ? "failed" : "succeeded", entityType: "marketing_social_composition", entityId: input.id, reason, response: { postCount: entries.length, failedPlatforms: failures.map((failure) => failure.platform), providerStatus: status } });
    revalidatePath("/admin/marketing"); return { success: true, data: saved };
  } catch (error) {
    if (auditContext) await activity(auditContext.db, auditContext.actor, { provider: "zernio", operation: "social.stop", status: "failed", entityType: "marketing_social_composition", entityId: input.id, reason: input.reason, error });
    return { success: false, error: message(error, "Unable to change external posts") };
  }
}

export async function getMarketingOperationsDashboard(): Promise<MarketingOperationsDashboard> {
  const { actor, db } = await context();
  const [recentPosts, recentSocial, automationResult] = await Promise.all([listMarketingBlogPosts(), listMarketingSocialCompositions(), db.from("marketing_automation_runs").select("*").order("started_at", { ascending: false }).limit(10)]);
  if (automationResult.error) throw new Error(automationResult.error.message);
  const recentAutomation = recordArray(automationResult.data).map(mapAutomationRun);
  let analytics;
  try {
    analytics = await fetchAnalyticsOverview(30);
    if (analytics.connected.ga4) await activity(db, actor, { provider: "google-analytics", operation: "analytics.overview", status: "succeeded", response: { windowDays: 30 } });
    if (analytics.connected.searchConsole) await activity(db, actor, { provider: "search-console", operation: "analytics.overview", status: "succeeded", response: { windowDays: 30 } });
  } catch (error) {
    const ready = googleReadiness();
    analytics = { connected: { ga4: ready.ga4, searchConsole: ready.searchConsole }, windowDays: 30, totalUsers: null, sessions: null, pageViews: null, conversions: null, searchClicks: null, searchImpressions: null, dailyUsers: [], topCountries: [] };
    if (ready.ga4) await activity(db, actor, { provider: "google-analytics", operation: "analytics.overview", status: "failed", error });
    if (ready.searchConsole) await activity(db, actor, { provider: "search-console", operation: "analytics.overview", status: "failed", error });
  }
  let socialAnalytics;
  try {
    socialAnalytics = await fetchZernioAnalytics(100);
    if (socialAnalytics.connected) await activity(db, actor, { provider: "zernio", operation: "analytics.overview", status: "succeeded", response: { postCount: socialAnalytics.postCount } });
  } catch (error) {
    socialAnalytics = { connected: Boolean(process.env.ZERNIO_API_KEY?.trim()), postCount: 0, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, views: 0, follows: 0, engagementRate: 0, lastSync: null };
    await activity(db, actor, { provider: "zernio", operation: "analytics.overview", status: "failed", error });
  }
  return { analytics, socialAnalytics, providers: providerReadiness(), recentPosts: recentPosts.slice(0, 10), recentSocial: recentSocial.slice(0, 10), recentAutomation };
}

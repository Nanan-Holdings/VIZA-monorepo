import { asMarketingDb, mapBlogAdminRecord, mapSocialComposition } from "./db";
import { createZernioPosts, findZernioCompositionPosts } from "./providers/zernio";
import { publishUploadPostImage } from "./providers/upload-post";
import { assertLiveMarketingUrl } from "./publish-check";
import { marketingCategorySlug, revalidatePublicMarketingBlog } from "./revalidate";
import { validatePublishableBlog } from "./validation";
import type { MarketingBlogAdminRecord, MarketingSocialCompositionRecord } from "./contracts";

/* Going public, with no session attached.

   The admin server actions used to own this outright, which meant the only
   way to publish an article or send its captions was for a person to be
   signed in and clicking. The scheduled pipeline has to do the same work with
   nothing but an admin client and an actor id, so the mechanics live here and
   both callers share them. Authorisation stays with the callers: the actions
   check the session role, and the automation checks its configured actor is an
   active admin before it starts. */

type Db = ReturnType<typeof asMarketingDb>;

export function publicMarketingBaseUrl(): URL {
  const raw = process.env.VIZA_MARKETING_PUBLIC_BASE_URL?.trim();
  if (!raw) throw new Error("VIZA_MARKETING_PUBLIC_BASE_URL is not configured");
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("VIZA_MARKETING_PUBLIC_BASE_URL must use HTTPS");
  }
  return url;
}

export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function logMarketingActivity(
  db: Db,
  actorId: string,
  input: {
    provider: "openrouter" | "deepseek" | "zernio" | "upload-post" | "google-analytics" | "search-console" | "system";
    operation: string;
    status: "started" | "succeeded" | "failed" | "skipped";
    entityType?: string;
    entityId?: string;
    reason?: string;
    request?: Record<string, unknown>;
    response?: Record<string, unknown>;
    error?: unknown;
  },
) {
  await db.from("marketing_provider_activity").insert({
    provider: input.provider,
    operation: input.operation,
    status: input.status,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    actor_user_id: actorId,
    request_metadata: { reason: input.reason?.trim().slice(0, 500) ?? null, ...(input.request ?? {}) },
    response_metadata: input.response ?? {},
    error_code: input.error instanceof Error ? input.error.name.slice(0, 100) : null,
    error_message: input.error ? errorText(input.error, "Provider operation failed").slice(0, 500) : null,
  });
}

/** Move an article to published and rebuild the pages that show it. */
export async function publishBlogPostById(input: {
  db: Db;
  actorId: string;
  postId: string;
  reason: string;
}): Promise<MarketingBlogAdminRecord> {
  const { db, actorId, postId } = input;
  const reason = input.reason.trim();
  if (!reason) throw new Error("Reason is required");
  const current = await db.from("marketing_blog_posts").select("*").eq("id", postId).maybeSingle();
  if (current.error || !current.data) throw new Error(current.error?.message ?? "Blog post not found");
  validatePublishableBlog(mapBlogAdminRecord(current.data));
  const row = current.data as Record<string, unknown>;
  const existingMetadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? (row.metadata as Record<string, unknown>)
    : {};
  const now = new Date().toISOString();
  const { data, error } = await db.from("marketing_blog_posts").update({
    status: "published",
    published_by: actorId,
    published_at: now,
    updated_by: actorId,
    updated_at: now,
    metadata: { ...existingMetadata, status_change_reason: reason },
  }).eq("id", postId).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Blog post not found");
  const saved = mapBlogAdminRecord(data);
  await logMarketingActivity(db, actorId, {
    provider: "system", operation: "blog.published", status: "succeeded",
    entityType: "marketing_blog_post", entityId: saved.id, reason,
  });
  await revalidatePublicMarketingBlog({
    locale: saved.locale,
    slug: saved.slug,
    category: saved.category ? marketingCategorySlug(saved.category) : undefined,
  }).catch(async (cause: unknown) => {
    await logMarketingActivity(db, actorId, {
      provider: "system", operation: "blog.revalidate", status: "failed",
      entityType: "marketing_blog_post", entityId: saved.id, reason, error: cause,
    });
  });
  return saved;
}

/** Hand a composition's captions to Zernio and Upload-Post. */
export async function publishSocialCompositionById(input: {
  db: Db;
  actorId: string;
  compositionId: string;
  reason: string;
}): Promise<MarketingSocialCompositionRecord> {
  const { db, actorId, compositionId } = input;
  const reason = input.reason.trim();
  if (!reason) throw new Error("Reason is required");
  const current = await db.from("marketing_social_compositions").select("*").eq("id", compositionId).maybeSingle();
  if (current.error || !current.data) throw new Error(current.error?.message ?? "Composition not found");
  const composition = mapSocialComposition(current.data);
  if (["scheduled", "publishing", "published"].includes(composition.status)) {
    throw new Error("Composition is already active; sync it instead of publishing again");
  }

  let destinationUrl = composition.destinationUrl ?? undefined;
  if (composition.shortLinkId) {
    const link = await db.from("marketing_short_links").select("code, active").eq("id", composition.shortLinkId).maybeSingle();
    if (link.error || !link.data || typeof link.data !== "object" || Array.isArray(link.data)) throw new Error("Tracked destination is unavailable");
    const row = link.data as Record<string, unknown>;
    if (row.active !== true || typeof row.code !== "string") throw new Error("Tracked destination is inactive");
    destinationUrl = new URL(`/s/${row.code}`, publicMarketingBaseUrl()).toString();
  }

  /* Never advertise a page that is not there yet. */
  if (composition.blogPostId) {
    const blog = await db.from("marketing_blog_posts").select("status, locale, slug").eq("id", composition.blogPostId).maybeSingle();
    if (blog.error || !blog.data || typeof blog.data !== "object" || Array.isArray(blog.data)) throw new Error("Linked blog post is unavailable");
    const row = blog.data as Record<string, unknown>;
    if (row.status !== "published") throw new Error("Publish the blog post before sending social captions");
    await assertLiveMarketingUrl(new URL(`${row.locale === "zh-CN" ? "/zh-CN" : ""}/blog/${String(row.slug)}`, publicMarketingBaseUrl()).toString());
  } else if (destinationUrl) {
    await assertLiveMarketingUrl(destinationUrl);
  }

  const uploadPlatforms = composition.platforms.filter((platform): platform is "instagram" | "pinterest" => platform === "instagram" || platform === "pinterest");
  if (composition.scheduledFor && uploadPlatforms.length) throw new Error("Upload-Post image channels do not support scheduling here; publish them when ready");
  const zernioPlatforms = composition.platforms.filter((platform) => platform !== "instagram" && platform !== "pinterest");
  const recoveredPosts = zernioPlatforms.length ? await findZernioCompositionPosts(composition.id) : {};
  const existingPosts = { ...recoveredPosts, ...composition.zernioPosts };
  const platformsToCreate = zernioPlatforms.filter((platform) => !existingPosts[platform]);
  const provider = platformsToCreate.length
    ? await createZernioPosts({
        compositionId: composition.id, title: composition.title, platforms: platformsToCreate,
        platformContent: composition.platformContent, scheduledFor: composition.scheduledFor ?? undefined,
        publishNow: !composition.scheduledFor, destinationUrl,
        mediaUrl: composition.mediaUrl ?? undefined, documentUrl: composition.documentUrl ?? undefined,
      })
    : { postIds: {}, failures: [] };
  const mergedPostIds = { ...existingPosts, ...provider.postIds };
  const uploadPosts = { ...composition.uploadPostPosts };
  const uploadFailures: Array<{ platform: string; error: string }> = [];
  for (const platform of uploadPlatforms) {
    if (uploadPosts[platform]?.status === "pending" || uploadPosts[platform]?.status === "published" || mergedPostIds[platform]) continue;
    try {
      if (!composition.mediaUrl) throw new Error("A reviewed cover image is required for image channels");
      const result = await publishUploadPostImage({
        platform, caption: composition.platformContent[platform] ?? "", title: composition.title,
        imageUrl: composition.mediaUrl, destinationUrl,
      });
      uploadPosts[platform] = { status: result.status, requestId: result.requestId, postId: result.postId, postUrl: result.postUrl };
    } catch (error) {
      uploadFailures.push({ platform, error: errorText(error, "Upload-Post failed") });
    }
  }

  const createdCount = Object.keys(mergedPostIds).length + Object.keys(uploadPosts).length;
  const failures = [...provider.failures, ...uploadFailures];
  if (!createdCount) throw new Error(failures[0]?.error ?? "No provider created a post");
  const now = new Date().toISOString();
  const allUploadPublished = Object.values(uploadPosts).every((post) => post.status === "published");
  const status = failures.length
    ? "partial"
    : composition.scheduledFor
      ? "scheduled"
      : Object.keys(mergedPostIds).length || !allUploadPublished
        ? "publishing"
        : "published";
  const updated = await db.from("marketing_social_compositions").update({
    status, zernio_posts: mergedPostIds, upload_post_posts: uploadPosts,
    updated_by: actorId, updated_at: now, last_synced_at: now,
  }).eq("id", compositionId).select("*").single();
  if (updated.error || !updated.data) throw new Error(updated.error?.message ?? "Unable to update composition");
  const saved = mapSocialComposition(updated.data);
  await logMarketingActivity(db, actorId, {
    provider: zernioPlatforms.length ? "zernio" : "upload-post",
    operation: composition.scheduledFor ? "social.schedule" : "social.publish",
    status: "succeeded", entityType: "marketing_social_composition", entityId: saved.id, reason,
    request: { platforms: composition.platforms, scheduled: Boolean(composition.scheduledFor) },
    response: { postCount: createdCount, failureCount: failures.length, failedPlatforms: failures.map((failure) => failure.platform), providerStatus: status },
  });
  return saved;
}

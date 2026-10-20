import { asMarketingDb, mapBlogAdminRecord, mapSocialComposition } from "./db";
import { createZernioPosts, findZernioCompositionPosts } from "./providers/zernio";
import { publishUploadPostImage, publishUploadPostVideo, uploadPostDelivery } from "./providers/upload-post";
import { isKelinHandle, kelinDirectReady, publishKelinPost, type KelinDirectPlatform } from "./providers/kelin";
import { fillLinkPlaceholders } from "./captions";
import { brandedImage } from "./social-image";
import { assertLiveMarketingUrl } from "./publish-check";
import { marketingCategorySlug, revalidatePublicMarketingBlog } from "./revalidate";
import { isVizaVideoPlatform, validatePublishableBlog } from "./validation";
import type { MarketingBlogAdminRecord, MarketingSocialCompositionRecord, MarketingSocialPlatform, UploadPostPlatform, VizaVideoPlatform } from "./contracts";

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

/* One send path for article captions and shorts alike.

   Each platform goes to the first sender that can take it:
   1. kelin-social (lib/social), our own direct sender, whenever that network's
      KELIN_* credentials are set: Facebook, Instagram (posts and Reels),
      LinkedIn, Pinterest, TikTok and YouTube.
   2. Upload-Post, for Instagram, Pinterest, TikTok or YouTube while that
      network is not connected directly yet.
   3. Zernio, only for networks neither of the above reaches.
   A platform that already has a post, or a delivery that is not failed, is
   left alone, so "Publish / retry" only resends what failed.

   Scheduling is ours. A composition set for later is saved as "scheduled"
   with its direct and Upload-Post platforms held back, and
   dispatchDueSocialCompositions (run every five minutes by Supabase pg_cron)
   sends them when they fall due. Only Zernio-only networks still use Zernio's
   own scheduler. */
type DeliveryFailure = { platform: string; error: string };

export async function publishSocialCompositionById(input: {
  db: Db;
  actorId: string;
  compositionId: string;
  reason: string;
  /** Set by the dispatcher: the composition's time has come, send what is held. */
  dispatch?: boolean;
  now?: Date;
}): Promise<MarketingSocialCompositionRecord & { failures?: DeliveryFailure[] }> {
  const { db, actorId, compositionId } = input;
  const reason = input.reason.trim();
  if (!reason) throw new Error("Reason is required");
  const current = await db.from("marketing_social_compositions").select("*").eq("id", compositionId).maybeSingle();
  if (current.error || !current.data) throw new Error(current.error?.message ?? "Composition not found");
  const composition = mapSocialComposition(current.data);
  const active = input.dispatch ? ["publishing", "published"] : ["scheduled", "publishing", "published"];
  if (active.includes(composition.status)) {
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

  const now = input.now ?? new Date();
  const scheduledLater = Boolean(composition.scheduledFor && !input.dispatch && Date.parse(composition.scheduledFor) > now.getTime());

  /* Never advertise a page that is not there yet (checked again at dispatch). */
  if (!scheduledLater) {
    if (composition.blogPostId) {
      const blog = await db.from("marketing_blog_posts").select("status, locale, slug").eq("id", composition.blogPostId).maybeSingle();
      if (blog.error || !blog.data || typeof blog.data !== "object" || Array.isArray(blog.data)) throw new Error("Linked blog post is unavailable");
      const row = blog.data as Record<string, unknown>;
      if (row.status !== "published") throw new Error("Publish the blog post before sending social captions");
      await assertLiveMarketingUrl(new URL(`${row.locale === "zh-CN" ? "/zh-CN" : ""}/blog/${String(row.slug)}`, publicMarketingBaseUrl()).toString());
    } else if (destinationUrl) {
      await assertLiveMarketingUrl(destinationUrl);
    }
  }

  const isShort = Boolean(composition.videoUrl);
  if (isShort) {
    if (!composition.videoUrl || !composition.videoLocale) throw new Error("Attach the rendered short and its language before publishing");
    if (!composition.platforms.some((platform) => isVizaVideoPlatform(platform))) throw new Error("Choose TikTok, Instagram Reels or YouTube Shorts for this short");
  }
  const captions = fillLinkPlaceholders(composition.platformContent, destinationUrl);
  /* Every network gets the cover with the logo stamped on it (app/social-card);
     the blog keeps it clean. Facebook's link card would show the page's
     og:image instead of the picture, so a stamped Facebook post goes out as a
     photo post with the address in its caption. */
  const cover = isShort ? undefined : composition.mediaUrl ?? undefined;
  const image = cover ? brandedImage(cover) ?? cover : undefined;
  const photoPost = (platform: MarketingSocialPlatform) => platform === "facebook" && Boolean(cover) && image !== cover;
  const captionFor = (platform: MarketingSocialPlatform) => {
    const caption = captions[platform] ?? "";
    return photoPost(platform) && destinationUrl && !caption.includes(destinationUrl) ? `${caption}\n\n${destinationUrl}` : caption;
  };
  const postIds = { ...composition.zernioPosts };
  const postUrls = { ...composition.zernioPostUrls };
  const uploadPosts = { ...composition.uploadPostPosts };
  const failures: DeliveryFailure[] = [];
  const held: MarketingSocialPlatform[] = [];
  const delivered = (platform: MarketingSocialPlatform) => Boolean(postIds[platform])
    || Boolean(uploadPosts[platform as UploadPostPlatform] && uploadPosts[platform as UploadPostPlatform]!.status !== "failed");
  const fail = (platform: MarketingSocialPlatform, error: unknown, fallback: string) => {
    const message = errorText(error, fallback).slice(0, 300);
    failures.push({ platform, error: message });
    return message;
  };

  const zernioPlatforms: MarketingSocialPlatform[] = [];
  for (const platform of composition.platforms) {
    if (delivered(platform)) continue;
    const direct = kelinDirectReady(platform);
    const uploadPost = !direct && (isShort ? isVizaVideoPlatform(platform) : platform === "instagram" || platform === "pinterest");
    if (!direct && !uploadPost) { zernioPlatforms.push(platform); continue; }
    if (scheduledLater) { held.push(platform); continue; }
    if (direct) {
      try {
        const sent = await publishKelinPost({
          platform: platform as KelinDirectPlatform, caption: captionFor(platform),
          title: isShort ? composition.videoTitle ?? composition.title : composition.title,
          destinationUrl: photoPost(platform) ? undefined : destinationUrl, imageUrl: image,
          videoUrl: isShort ? composition.videoUrl ?? undefined : undefined,
          aiGenerated: isShort,
        });
        postIds[platform] = sent.handle;
        if (sent.url) postUrls[platform] = sent.url;
      } catch (error) {
        fail(platform, error, "Direct post failed");
      }
      continue;
    }
    try {
      if (isShort) {
        const result = await publishUploadPostVideo({
          platform: platform as VizaVideoPlatform, compositionId: composition.id, attemptKey: composition.updatedAt,
          caption: captions[platform] ?? "", title: composition.videoTitle ?? composition.title,
          videoUrl: composition.videoUrl!, locale: composition.videoLocale!,
        });
        uploadPosts[platform as UploadPostPlatform] = uploadPostDelivery(result);
      } else {
        if (!composition.mediaUrl) throw new Error("A reviewed cover image is required for image channels");
        const result = await publishUploadPostImage({
          platform: platform as "instagram" | "pinterest", caption: captions[platform] ?? "", title: composition.title,
          imageUrl: image ?? composition.mediaUrl, destinationUrl,
        });
        uploadPosts[platform as UploadPostPlatform] = uploadPostDelivery(result);
      }
    } catch (error) {
      /* Kept on the composition, not only counted: Instagram and Pinterest
         failed on every automatic run from 6 to 16 Oct 2026 and nothing
         recorded why, then reconciliation relabelled the run "published". */
      const message = fail(platform, error, "Upload-Post failed");
      uploadPosts[platform as UploadPostPlatform] = { status: "failed", requestId: null, jobId: null, postId: null, postUrl: null, error: message };
    }
  }

  if (zernioPlatforms.length) {
    const recovered = await findZernioCompositionPosts(composition.id);
    for (const [platform, id] of Object.entries(recovered)) if (id && !postIds[platform as MarketingSocialPlatform]) postIds[platform as MarketingSocialPlatform] = id;
    const toCreate = zernioPlatforms.filter((platform) => !postIds[platform]);
    if (toCreate.length) {
      const provider = await createZernioPosts({
        compositionId: composition.id, title: composition.title, platforms: toCreate,
        platformContent: captions, scheduledFor: scheduledLater ? composition.scheduledFor ?? undefined : undefined,
        publishNow: !scheduledLater, destinationUrl,
        mediaUrl: image ?? composition.mediaUrl ?? undefined, documentUrl: composition.documentUrl ?? undefined,
      });
      Object.assign(postIds, provider.postIds);
      for (const failure of provider.failures) failures.push({ platform: failure.platform, error: (failure.error ?? "Zernio failed").slice(0, 300) });
    }
  }

  const liveCount = Object.values(postIds).filter(Boolean).length + Object.values(uploadPosts).filter((post) => post && post.status !== "failed").length;
  if (!liveCount && !held.length) throw new Error(failures[0]?.error ?? "No provider created a post");
  const pending = Object.values(postIds).some((id) => id && !isKelinHandle(id))
    || Object.values(uploadPosts).some((post) => post && (post.status === "pending" || post.status === "scheduled"));
  const status: MarketingSocialCompositionRecord["status"] = failures.length
    ? "partial"
    : held.length
      ? "scheduled"
      : pending ? "publishing" : "published";
  const stamp = new Date().toISOString();
  const updated = await db.from("marketing_social_compositions").update({
    status, zernio_posts: postIds, zernio_post_urls: postUrls, upload_post_posts: uploadPosts,
    updated_by: actorId, updated_at: stamp, last_synced_at: stamp,
  }).eq("id", compositionId).select("*").single();
  if (updated.error || !updated.data) throw new Error(updated.error?.message ?? "Unable to update composition");
  const saved = mapSocialComposition(updated.data);
  await logMarketingActivity(db, actorId, {
    provider: zernioPlatforms.length ? "zernio" : Object.values(uploadPosts).length ? "upload-post" : "system",
    operation: input.dispatch ? "social.dispatch" : scheduledLater ? "social.schedule" : isShort ? "social.video.publish" : "social.publish",
    status: "succeeded", entityType: "marketing_social_composition", entityId: saved.id, reason,
    request: { platforms: composition.platforms, scheduled: scheduledLater, held, short: isShort },
    response: { postCount: liveCount, failureCount: failures.length, failedPlatforms: failures.map((failure) => failure.platform), failures, providerStatus: status },
  });
  return { ...saved, failures };
}

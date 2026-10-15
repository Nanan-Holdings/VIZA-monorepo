/** Upload-Post delivery for VIZA: Instagram and Pinterest images, and
    vertical shorts on TikTok, Instagram Reels and YouTube Shorts. */

import { randomUUID } from "node:crypto";
import type { MarketingBlogLocale, UploadPostDelivery, UploadPostPlatform, VizaVideoPlatform } from "../contracts";

export type { UploadPostPlatform } from "../contracts";

const BASE = "https://api.upload-post.com/api";

/* VIZA's own Pinterest board, the one every article pin lands on. A board id
   is public: it is the number in the pin URL, so there is nothing here worth
   keeping in an environment variable, and putting it in one only meant the
   channel failed wherever someone forgot to set it. Set
   UPLOAD_POST_PINTEREST_BOARD_ID to point the pipeline at a different board
   without a code change. */
const DEFAULT_PINTEREST_BOARD_ID = "1092685997032493694";

function pinterestBoardId(): string {
  return process.env.UPLOAD_POST_PINTEREST_BOARD_ID?.trim() || DEFAULT_PINTEREST_BOARD_ID;
}
type UploadPostImagePlatform = "instagram" | "pinterest";

export interface UploadPostImageInput {
  platform: UploadPostImagePlatform;
  caption: string;
  title: string;
  imageUrl: string;
  destinationUrl?: string;
}

export interface UploadPostVideoInput {
  platform: VizaVideoPlatform;
  /** The composition this short belongs to, echoed back as `external_id`. */
  compositionId: string;
  /** Changes whenever the composition is edited, so a deliberate retry is a
      new upload while a retried request after a timeout is not. */
  attemptKey: string;
  caption: string;
  /** YouTube title (100 characters); TikTok and Reels use the caption. */
  title: string;
  videoUrl: string;
  locale: MarketingBlogLocale;
  scheduledFor?: string;
}

export type UploadPostImageResult =
  | { status: "published"; postId: string | null; postUrl: string | null; requestId: string | null; jobId?: string }
  | { status: "pending"; postId: null; postUrl: null; requestId: string };

export type UploadPostVideoResult = UploadPostImageResult
  | { status: "scheduled" | "pending"; postId: null; postUrl: null; requestId: null; jobId: string };

export type UploadPostJobResult = UploadPostVideoResult
  | { status: "failed"; postId: null; postUrl: null; requestId: string | null; jobId?: string; error: string };

interface UploadPostConfig { apiKey: string; user: string; boardId: string | null }

export function uploadPostReadiness(): { connected: boolean; missing: string[] } {
  const missing = [
    ...(!process.env.UPLOAD_POST_API_KEY?.trim() ? ["UPLOAD_POST_API_KEY"] : []),
    ...(!process.env.UPLOAD_POST_USER?.trim() ? ["UPLOAD_POST_USER"] : []),
  ];
  return { connected: missing.length === 0, missing };
}

/* Shorts are private until someone has looked at the real accounts and said
   so: TikTok posts as "only me", YouTube as private, and Instagram, which has
   no private Reel, refuses. Set UPLOAD_POST_VIDEO_VISIBILITY=public to post
   for real. Anything else, including a typo, stays private. */
export function uploadPostVideoVisibility(): "private" | "public" {
  return process.env.UPLOAD_POST_VIDEO_VISIBILITY?.trim().toLowerCase() === "public" ? "public" : "private";
}

function config(platform: UploadPostPlatform): UploadPostConfig {
  const readiness = uploadPostReadiness();
  if (!readiness.connected) throw new Error(`${readiness.missing.join(", ")} is not configured`);
  return {
    apiKey: process.env.UPLOAD_POST_API_KEY!.trim(),
    user: process.env.UPLOAD_POST_USER!.trim(),
    boardId: platform === "pinterest" ? pinterestBoardId() : null,
  };
}

function httpsUrl(value: string, label: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return url.toString();
  } catch { /* invalid URL */ }
  throw new Error(`${label} must be a public HTTPS URL`);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Upload-Post returned invalid JSON");
  return value as Record<string, unknown>;
}

async function jsonResponse(response: Response, operation: string): Promise<Record<string, unknown>> {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    const detail = typeof body?.message === "string" ? body.message : typeof body?.error === "string" ? body.error : null;
    throw new Error(`Upload-Post ${operation} failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
  try { return record(await response.json()); }
  catch { throw new Error(`Upload-Post ${operation} returned invalid JSON`); }
}

/* TikTok reports a video that fell back to the inbox with the post_url
   "Video sent to Inbox (No Public URL)". Only a real HTTPS address is a URL. */
function publicUrl(platform: UploadPostPlatform, url: unknown, postId: unknown): string | null {
  if (platform === "pinterest" && typeof postId === "string" && /^\d+$/.test(postId)) {
    return `https://www.pinterest.com/pin/${postId}/`;
  }
  if (typeof url !== "string") return null;
  try { return httpsUrl(url, "Provider post URL"); } catch { return null; }
}

function postIdentifier(result: Record<string, unknown>): string | null {
  for (const key of ["platform_post_id", "post_id", "video_id", "publish_id"]) {
    if (typeof result[key] === "string" && result[key]) return result[key] as string;
  }
  return null;
}

function publishedResult(platform: UploadPostPlatform, result: Record<string, unknown>, requestId: string | null): UploadPostImageResult {
  const id = postIdentifier(result);
  const url = publicUrl(platform, result.post_url ?? result.url, id);
  if (!id && !url) throw new Error(`Upload-Post ${platform} reported success without a post identifier or URL`);
  return { status: "published", postId: id, postUrl: url, requestId };
}

async function socialAccounts(settings: UploadPostConfig): Promise<Record<string, unknown>> {
  const response = await fetch(`${BASE}/uploadposts/users`, {
    headers: { Authorization: `Apikey ${settings.apiKey}` }, signal: AbortSignal.timeout(15_000),
  });
  const body = await jsonResponse(response, "profile lookup");
  const profiles = Array.isArray(body.profiles) ? body.profiles : [];
  const profile = profiles.find((value) => value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).username === settings.user) as Record<string, unknown> | undefined;
  if (!profile) throw new Error(`Upload-Post profile ${settings.user} was not found`);
  const accounts = profile.social_accounts;
  return accounts && typeof accounts === "object" && !Array.isArray(accounts) ? accounts as Record<string, unknown> : {};
}

async function profileConnected(platform: UploadPostPlatform, settings: UploadPostConfig): Promise<void> {
  if (!(await socialAccounts(settings))[platform]) {
    throw new Error(`${platform} is not connected to the configured Upload-Post profile`);
  }
}

/** Which Upload-Post channels the VIZA profile has an account for. Readiness
    only: an unreachable provider reads as nothing connected. */
export async function uploadPostConnectedPlatforms(): Promise<UploadPostPlatform[]> {
  if (!uploadPostReadiness().connected) return [];
  try {
    const accounts = await socialAccounts(config("instagram"));
    return (["instagram", "pinterest", "tiktok", "youtube"] as const).filter((platform) => Boolean(accounts[platform]));
  } catch { return []; }
}

/** One read-only provider status request for cron reconciliation and retries.
    `kind` is "request" for an immediate upload and "job" for a scheduled one. */
export async function checkUploadPostJob(id: string, platform: UploadPostPlatform, kind: "request" | "job" = "request"): Promise<UploadPostJobResult> {
  if (!["instagram", "pinterest", "tiktok", "youtube"].includes(platform)) throw new Error("Unsupported Upload-Post platform");
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new Error("Invalid Upload-Post request id");
  const settings = config(platform);
  const requestId = kind === "request" ? id : null;
  const unchanged: UploadPostJobResult = kind === "request"
    ? { status: "pending", postId: null, postUrl: null, requestId: id }
    : { status: "scheduled", postId: null, postUrl: null, requestId: null, jobId: id };
  let response: Response;
  try {
    response = await fetch(`${BASE}/uploadposts/status?${kind === "request" ? "request_id" : "job_id"}=${encodeURIComponent(id)}`, {
      headers: { Authorization: `Apikey ${settings.apiKey}` }, signal: AbortSignal.timeout(15_000),
    });
  } catch { return unchanged; }
  if (!response.ok) return unchanged;
  let body: Record<string, unknown>;
  try { body = record(await response.json()); }
  catch { return unchanged; }
  const results = Array.isArray(body.results) ? body.results : [];
  const match = results.find((value) => value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).platform === platform) as Record<string, unknown> | undefined;
  const failed = (error: string): UploadPostJobResult => ({ status: "failed", postId: null, postUrl: null, requestId, ...(kind === "job" ? { jobId: id } : {}), error: error.slice(0, 300) });
  // A job handed off to Upload-Post's worker reports each platform as
  // `status: "queued"` with `success: false` until it runs, so `success` alone
  // cannot tell "not yet" from "rejected". Only an explicit failed status fails.
  const platformStatus = typeof match?.status === "string" ? match.status : null;
  if (platformStatus === "skipped" || match?.skipped === true) return failed(`${platform} is not connected to the configured Upload-Post profile`);
  if (platformStatus === "failed" || body.status === "failed") {
    return failed(typeof match?.error_message === "string" ? match.error_message : typeof match?.error === "string" ? match.error : "Provider job failed");
  }
  if (match?.success === true) {
    const published = publishedResult(platform, match, requestId);
    return kind === "job" && published.status === "published" ? { ...published, jobId: id } : published;
  }
  if (body.status === "completed") return failed("Provider job completed without a successful platform result");
  // A scheduled job that has not run yet reports `pending` with no results.
  if (kind === "job" && !match) return unchanged;
  return kind === "request" ? unchanged : { status: "pending", postId: null, postUrl: null, requestId: null, jobId: id };
}

async function waitForJob(requestId: string, platform: UploadPostImagePlatform): Promise<UploadPostImageResult> {
  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    const result = await checkUploadPostJob(requestId, platform);
    if (result.status === "failed") throw new Error(`Upload-Post ${platform} rejected the post: ${result.error}`);
    if (result.status === "published") return result;
  }
  return { status: "pending", postId: null, postUrl: null, requestId };
}

export async function publishUploadPostImage(input: UploadPostImageInput): Promise<UploadPostImageResult> {
  if (input.platform !== "instagram" && input.platform !== "pinterest") throw new Error("Upload-Post only supports Instagram and Pinterest here");
  const settings = config(input.platform);
  const imageUrl = httpsUrl(input.imageUrl, "Image URL");
  const destinationUrl = input.destinationUrl ? httpsUrl(input.destinationUrl, "Destination URL") : null;
  if (input.platform === "pinterest" && !destinationUrl) throw new Error("Pinterest requires a destination URL");
  if (!input.caption.trim() || !input.title.trim()) throw new Error("Caption and title are required");
  await profileConnected(input.platform, settings);

  const form = new FormData();
  form.set("user", settings.user);
  form.append("platform[]", input.platform);
  form.append("photos[]", imageUrl);
  if (input.platform === "instagram") {
    // Upload-Post uses generic title for Instagram's visible caption.
    form.set("title", input.caption);
    form.set("instagram_title", input.caption);
    form.set("media_type", "IMAGE");
  } else {
    form.set("title", input.title);
    form.set("pinterest_title", input.title.slice(0, 100));
    form.set("pinterest_description", input.caption);
    form.set("pinterest_board_id", settings.boardId!);
    form.set("pinterest_link", destinationUrl!);
    form.set("pinterest_alt_text", input.title.slice(0, 500));
  }

  const response = await fetch(`${BASE}/upload_photos`, {
    method: "POST", headers: { Authorization: `Apikey ${settings.apiKey}` }, body: form,
    signal: AbortSignal.timeout(90_000),
  });
  const body = await jsonResponse(response, "image upload");
  const results = body.results && typeof body.results === "object" && !Array.isArray(body.results) ? body.results as Record<string, unknown> : {};
  const match = results[input.platform] && typeof results[input.platform] === "object" && !Array.isArray(results[input.platform]) ? results[input.platform] as Record<string, unknown> : null;
  if (body.success === false || match?.success === false) {
    throw new Error(`Upload-Post ${input.platform} rejected the post: ${typeof match?.error === "string" ? match.error.slice(0, 300) : "provider rejected the job"}`);
  }
  const requestId = typeof body.request_id === "string" ? body.request_id : null;
  if (match?.success === true || (match && (match.url || match.post_id))) return publishedResult(input.platform, match, requestId);
  if (!requestId) throw new Error("Upload-Post returned neither a post result nor a request id");
  return waitForJob(requestId, input.platform);
}

/* The per-platform fields for a short. Every one of them carries the
   platform's own AI-content disclosure: the script is drafted by DeepSeek and
   the voice is synthetic, and TikTok and Instagram restrict unlabelled AI
   media. YouTube's flag is containsSyntheticMedia. */
function videoFields(form: FormData, input: UploadPostVideoInput, visibility: "private" | "public") {
  if (input.platform === "tiktok") {
    form.set("tiktok_title", input.caption);
    form.set("post_mode", "DIRECT_POST");
    form.set("is_aigc", "true");
    if (visibility === "private") form.set("privacy_level", "SELF_ONLY");
    // VIZA promoting its own service is TikTok's "your brand" disclosure.
    else form.set("brand_organic_toggle", "true");
  } else if (input.platform === "instagram") {
    form.set("instagram_title", input.caption);
    form.set("media_type", "REELS");
    form.set("share_to_feed", "true");
    form.set("is_ai_generated", "true");
  } else {
    form.set("youtube_title", input.title);
    form.set("youtube_description", input.caption);
    form.set("privacyStatus", visibility);
    form.set("containsSyntheticMedia", "true");
    form.set("selfDeclaredMadeForKids", "false");
    // 27 is Education, the closest YouTube category to a visa explainer.
    form.set("categoryId", "27");
    form.set("defaultLanguage", input.locale);
    form.set("defaultAudioLanguage", input.locale);
  }
}

/** Post one short to one platform, now or at `scheduledFor`. Returns pending
    (track by request id), scheduled (track by job id) or published. */
export async function publishUploadPostVideo(input: UploadPostVideoInput): Promise<UploadPostVideoResult> {
  if (!["tiktok", "instagram", "youtube"].includes(input.platform)) throw new Error("Upload-Post shorts go to TikTok, Instagram Reels and YouTube Shorts only");
  const settings = config(input.platform);
  const videoUrl = httpsUrl(input.videoUrl, "Video URL");
  if (!input.caption.trim()) throw new Error("A caption is required");
  if (input.platform === "youtube" && !input.title.trim()) throw new Error("YouTube Shorts need a title");
  if (input.locale !== "en" && input.locale !== "zh-CN") throw new Error("Unsupported short locale");
  let scheduledFor: string | null = null;
  if (input.scheduledFor) {
    const timestamp = Date.parse(input.scheduledFor);
    if (!Number.isFinite(timestamp)) throw new Error("Scheduled time is invalid");
    if (timestamp <= Date.now() + 60_000) throw new Error("The scheduled time has passed; choose a later time or clear it to post now");
    scheduledFor = new Date(timestamp).toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  const visibility = uploadPostVideoVisibility();
  if (input.platform === "instagram" && visibility === "private") {
    throw new Error("Instagram has no private Reels; set UPLOAD_POST_VIDEO_VISIBILITY=public once the VIZA Instagram account is confirmed");
  }
  await profileConnected(input.platform, settings);

  const form = new FormData();
  form.set("user", settings.user);
  form.append("platform[]", input.platform);
  form.set("video", videoUrl);
  form.set("title", input.platform === "youtube" ? input.title : input.caption);
  form.set("external_id", input.compositionId.slice(0, 255));
  videoFields(form, input, visibility);
  /* Our own request id, so a response lost to a timeout can still be polled,
     and an idempotency key, so retrying that same request never posts twice. */
  const requestId = `viza_${input.platform}_${randomUUID()}`;
  if (scheduledFor) {
    form.set("scheduled_date", scheduledFor);
  } else {
    form.set("async_upload", "true");
    form.set("request_id", requestId);
  }
  const idempotencyKey = `viza:${input.compositionId}:${input.platform}:${input.attemptKey}`.slice(0, 255);

  let response: Response;
  try {
    response = await fetch(`${BASE}/upload`, {
      method: "POST",
      headers: { Authorization: `Apikey ${settings.apiKey}`, "Idempotency-Key": idempotencyKey },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    // Upload-Post may have the request; the reconcile cron will find out.
    if (!scheduledFor) return { status: "pending", postId: null, postUrl: null, requestId };
    throw error;
  }
  const body = await jsonResponse(response, "video upload");
  const results = body.results && typeof body.results === "object" && !Array.isArray(body.results) ? body.results as Record<string, unknown> : {};
  const match = results[input.platform] && typeof results[input.platform] === "object" && !Array.isArray(results[input.platform]) ? results[input.platform] as Record<string, unknown> : null;
  if (match?.skipped === true) throw new Error(`${input.platform} is not connected to the configured Upload-Post profile`);
  if (body.success === false || match?.success === false) {
    const reason = typeof match?.error === "string" ? match.error : typeof body.message === "string" ? body.message : "provider rejected the job";
    throw new Error(`Upload-Post ${input.platform} rejected the short: ${reason.slice(0, 300)}`);
  }
  if (typeof body.job_id === "string" && body.job_id) {
    return { status: "scheduled", postId: null, postUrl: null, requestId: null, jobId: body.job_id };
  }
  const returnedId = typeof body.request_id === "string" && body.request_id ? body.request_id : null;
  if (match?.success === true) return publishedResult(input.platform, match, returnedId ?? requestId);
  if (scheduledFor) throw new Error("Upload-Post accepted the scheduled short without a job id");
  return { status: "pending", postId: null, postUrl: null, requestId: returnedId ?? requestId };
}

/** Cancel a scheduled short before it runs. Upload-Post deletes the job and
    refunds its credits; a job that already ran cannot be cancelled. */
export async function cancelUploadPostSchedule(jobId: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(jobId)) throw new Error("Invalid Upload-Post job id");
  const settings = config("tiktok");
  const response = await fetch(`${BASE}/uploadposts/schedule/${encodeURIComponent(jobId)}`, {
    method: "DELETE", headers: { Authorization: `Apikey ${settings.apiKey}` }, signal: AbortSignal.timeout(15_000),
  });
  const body = await jsonResponse(response, "schedule cancellation");
  if (body.success === false) throw new Error(`Upload-Post could not cancel job ${jobId}`);
}

export function uploadPostDelivery(result: UploadPostJobResult): UploadPostDelivery {
  return {
    status: result.status,
    requestId: result.requestId,
    jobId: "jobId" in result ? result.jobId ?? null : null,
    postId: result.postId,
    postUrl: result.postUrl,
    error: result.status === "failed" ? result.error : null,
  };
}

/** Bring every unfinished Upload-Post delivery of a composition up to date:
    pending uploads by request id, scheduled shorts by job id. */
export async function refreshUploadPostDeliveries(
  posts: Partial<Record<UploadPostPlatform, UploadPostDelivery>>,
): Promise<Partial<Record<UploadPostPlatform, UploadPostDelivery>>> {
  const next = { ...posts };
  for (const platform of ["instagram", "pinterest", "tiktok", "youtube"] as const) {
    const item = next[platform];
    if (!item) continue;
    let checked: UploadPostJobResult | null = null;
    if ((item.status === "scheduled" || item.status === "pending") && item.jobId) checked = await checkUploadPostJob(item.jobId, platform, "job");
    else if (item.status === "pending" && item.requestId) checked = await checkUploadPostJob(item.requestId, platform, "request");
    if (!checked) continue;
    const delivery = uploadPostDelivery(checked);
    next[platform] = { ...delivery, jobId: delivery.jobId ?? item.jobId ?? null };
  }
  return next;
}

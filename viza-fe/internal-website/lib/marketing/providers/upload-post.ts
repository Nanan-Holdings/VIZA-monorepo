/** Image-first distribution for VIZA's Instagram and Pinterest accounts. */

const BASE = "https://api.upload-post.com/api";
export type UploadPostPlatform = "instagram" | "pinterest";

export interface UploadPostImageInput {
  platform: UploadPostPlatform;
  caption: string;
  title: string;
  imageUrl: string;
  destinationUrl?: string;
}

export type UploadPostImageResult =
  | { status: "published"; postId: string | null; postUrl: string | null; requestId: string | null }
  | { status: "pending"; postId: null; postUrl: null; requestId: string };

export type UploadPostJobResult = UploadPostImageResult
  | { status: "failed"; postId: null; postUrl: null; requestId: string; error: string };

interface UploadPostConfig { apiKey: string; user: string; boardId: string | null }

export function uploadPostReadiness(platform: UploadPostPlatform): { connected: boolean; missing: string[] } {
  const missing = [
    ...(!process.env.UPLOAD_POST_API_KEY?.trim() ? ["UPLOAD_POST_API_KEY"] : []),
    ...(!process.env.UPLOAD_POST_USER?.trim() ? ["UPLOAD_POST_USER"] : []),
    ...(platform === "pinterest" && !process.env.UPLOAD_POST_PINTEREST_BOARD_ID?.trim() ? ["UPLOAD_POST_PINTEREST_BOARD_ID"] : []),
  ];
  return { connected: missing.length === 0, missing };
}

function config(platform: UploadPostPlatform): UploadPostConfig {
  const readiness = uploadPostReadiness(platform);
  if (!readiness.connected) throw new Error(`${readiness.missing.join(", ")} is not configured`);
  return {
    apiKey: process.env.UPLOAD_POST_API_KEY!.trim(),
    user: process.env.UPLOAD_POST_USER!.trim(),
    boardId: process.env.UPLOAD_POST_PINTEREST_BOARD_ID?.trim() || null,
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
  if (!response.ok) throw new Error(`Upload-Post ${operation} failed (${response.status})`);
  try { return record(await response.json()); }
  catch { throw new Error(`Upload-Post ${operation} returned invalid JSON`); }
}

function publicUrl(platform: UploadPostPlatform, url: unknown, postId: unknown): string | null {
  if (platform === "pinterest" && typeof postId === "string" && /^\d+$/.test(postId)) {
    return `https://www.pinterest.com/pin/${postId}/`;
  }
  return typeof url === "string" ? httpsUrl(url, "Provider post URL") : null;
}

function publishedResult(platform: UploadPostPlatform, result: Record<string, unknown>, requestId: string | null): UploadPostImageResult {
  const id = typeof result.platform_post_id === "string" ? result.platform_post_id
    : typeof result.post_id === "string" ? result.post_id : null;
  const url = publicUrl(platform, result.post_url ?? result.url, id);
  if (!id && !url) throw new Error(`Upload-Post ${platform} reported success without a post identifier or URL`);
  return { status: "published", postId: id, postUrl: url, requestId };
}

async function profileConnected(platform: UploadPostPlatform, settings: UploadPostConfig): Promise<void> {
  const response = await fetch(`${BASE}/uploadposts/users`, {
    headers: { Authorization: `Apikey ${settings.apiKey}` }, signal: AbortSignal.timeout(15_000),
  });
  const body = await jsonResponse(response, "profile lookup");
  const profiles = Array.isArray(body.profiles) ? body.profiles : [];
  const profile = profiles.find((value) => value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).username === settings.user) as Record<string, unknown> | undefined;
  if (!profile) throw new Error(`Upload-Post profile ${settings.user} was not found`);
  const accounts = profile.social_accounts;
  if (!accounts || typeof accounts !== "object" || Array.isArray(accounts) || !(accounts as Record<string, unknown>)[platform]) {
    throw new Error(`${platform} is not connected to the configured Upload-Post profile`);
  }
}

/** One read-only provider status request for cron reconciliation and retries. */
export async function checkUploadPostJob(requestId: string, platform: UploadPostPlatform): Promise<UploadPostJobResult> {
  if (platform !== "instagram" && platform !== "pinterest") throw new Error("Unsupported Upload-Post platform");
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(requestId)) throw new Error("Invalid Upload-Post request id");
  const settings = config(platform);
  const pending: UploadPostJobResult = { status: "pending", postId: null, postUrl: null, requestId };
  let response: Response;
  try {
    response = await fetch(`${BASE}/uploadposts/status?request_id=${encodeURIComponent(requestId)}`, {
      headers: { Authorization: `Apikey ${settings.apiKey}` }, signal: AbortSignal.timeout(15_000),
    });
  } catch { return pending; }
  if (!response.ok) return pending;
  let body: Record<string, unknown>;
  try { body = record(await response.json()); }
  catch { return pending; }
  const results = Array.isArray(body.results) ? body.results : [];
  const match = results.find((value) => value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).platform === platform) as Record<string, unknown> | undefined;
  if (match?.success === false || body.status === "failed") {
    return { status: "failed", postId: null, postUrl: null, requestId, error: typeof match?.error_message === "string" ? match.error_message.slice(0, 300) : "Provider job failed" };
  }
  if (match?.success === true) return publishedResult(platform, match, requestId);
  if (body.status === "completed") {
    return { status: "failed", postId: null, postUrl: null, requestId, error: "Provider job completed without a successful platform result" };
  }
  return pending;
}

async function waitForJob(requestId: string, platform: UploadPostPlatform): Promise<UploadPostImageResult> {
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

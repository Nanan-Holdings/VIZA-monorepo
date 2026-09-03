import type { MarketingSocialAnalytics, MarketingSocialPlatform } from "../contracts";
import { MarketingProviderConfigError } from "./openrouter";

const ZERNIO_PLATFORM: Record<MarketingSocialPlatform, string> = {
  x: "twitter", "google-business-sg": "googlebusiness", instagram: "instagram",
  linkedin: "linkedin", pinterest: "pinterest", reddit: "reddit",
};
const ACCOUNT_ENV: Record<MarketingSocialPlatform, string> = {
  x: "ZERNIO_ACCOUNT_ID_X", "google-business-sg": "ZERNIO_ACCOUNT_ID_GOOGLE_BUSINESS_SG",
  instagram: "ZERNIO_ACCOUNT_ID_INSTAGRAM", linkedin: "ZERNIO_ACCOUNT_ID_LINKEDIN",
  pinterest: "ZERNIO_ACCOUNT_ID_PINTEREST", reddit: "ZERNIO_ACCOUNT_ID_REDDIT",
};
const CONTENT_LIMITS: Record<MarketingSocialPlatform, number> = { x: 280, "google-business-sg": 1_500, instagram: 2_200, linkedin: 3_000, pinterest: 500, reddit: 10_000 };

function providerContent(platform: MarketingSocialPlatform, content: string, destinationUrl?: string) {
  const clean = content.trim();
  if (!destinationUrl || platform === "instagram" || platform === "pinterest" || clean.includes(destinationUrl)) return clean;
  const suffix = `\n\n${destinationUrl}`;
  const max = CONTENT_LIMITS[platform];
  if (clean.length + suffix.length <= max) return `${clean}${suffix}`;
  const budget = Math.max(0, max - suffix.length - 1);
  const prefix = clean.slice(0, budget).replace(/\s+\S*$/, "").trimEnd();
  return `${prefix}…${suffix}`;
}

function zernioConfig(platforms: readonly MarketingSocialPlatform[]) {
  const apiKey = process.env.ZERNIO_API_KEY?.trim();
  const timezone = process.env.ZERNIO_TIMEZONE?.trim();
  if (!apiKey) throw new MarketingProviderConfigError("ZERNIO_API_KEY is not configured");
  if (!timezone) throw new MarketingProviderConfigError("ZERNIO_TIMEZONE is not configured");
  const targets = platforms.map((platform) => {
    const accountId = process.env[ACCOUNT_ENV[platform]]?.trim();
    if (!accountId) throw new MarketingProviderConfigError(`${ACCOUNT_ENV[platform]} is not configured`);
    if (platform === "pinterest" && !process.env.ZERNIO_PINTEREST_BOARD_ID?.trim()) throw new MarketingProviderConfigError("ZERNIO_PINTEREST_BOARD_ID is not configured");
    if (platform === "reddit" && !process.env.ZERNIO_REDDIT_SUBREDDIT?.trim()) throw new MarketingProviderConfigError("ZERNIO_REDDIT_SUBREDDIT is not configured");
    return { platform: ZERNIO_PLATFORM[platform], accountId };
  });
  return { apiKey, timezone, targets };
}

async function request(path: string, apiKey: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(`https://zernio.com/api/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Zernio request failed (${response.status})`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Zernio returned invalid JSON");
  return body as Record<string, unknown>;
}

function postId(body: Record<string, unknown>): string | null {
  const post = body.post;
  if (post && typeof post === "object" && !Array.isArray(post) && typeof (post as Record<string, unknown>)._id === "string") {
    return (post as Record<string, unknown>)._id as string;
  }
  return typeof body._id === "string" ? body._id : null;
}

function platformEntry(platform: MarketingSocialPlatform, target: { platform: string; accountId: string }, input: { title: string; destinationUrl?: string }) {
  const platformSpecificData: Record<string, string> = {};
  if (platform === "pinterest") {
    platformSpecificData.title = input.title.slice(0, 100);
    platformSpecificData.boardId = process.env.ZERNIO_PINTEREST_BOARD_ID!.trim();
    if (input.destinationUrl) platformSpecificData.link = input.destinationUrl;
  }
  if (platform === "reddit") {
    platformSpecificData.title = input.title.slice(0, 300);
    platformSpecificData.subreddit = process.env.ZERNIO_REDDIT_SUBREDDIT!.trim().replace(/^\/?r\//, "");
  }
  return { ...target, ...(Object.keys(platformSpecificData).length ? { platformSpecificData } : {}) };
}

export async function createZernioPosts(input: { compositionId: string; title: string; platforms: readonly MarketingSocialPlatform[]; platformContent: Partial<Record<MarketingSocialPlatform, string>>; scheduledFor?: string; publishNow: boolean; destinationUrl?: string; mediaUrl?: string; documentUrl?: string }) {
  const { apiKey, timezone, targets } = zernioConfig(input.platforms);
  const results = await Promise.all(input.platforms.map(async (platform, index) => {
    try {
      const target = platformEntry(platform, targets[index], input);
      const content = providerContent(platform, input.platformContent[platform] ?? "", input.destinationUrl);
      const draftPayload: Record<string, unknown> = {
        title: input.title.slice(0, 120),
        content,
        isDraft: true,
        platforms: [target],
        metadata: { vizaKind: "marketing-composition", vizaCompositionId: input.compositionId, vizaPlatform: platform },
      };
      const mediaItems: Array<{ type: "image" | "document"; url: string }> = [];
      if (input.documentUrl && platform === "linkedin") mediaItems.push({ type: "document", url: input.documentUrl });
      else if (input.mediaUrl && platform !== "reddit") mediaItems.push({ type: "image", url: input.mediaUrl });
      if (mediaItems.length) draftPayload.mediaItems = mediaItems;
      const created = await request("/posts", apiKey, { method: "POST", body: JSON.stringify(draftPayload) });
      const id = postId(created);
      if (!id) throw new Error("Zernio returned no post id");
      if (input.scheduledFor || input.publishNow) {
        const finalPayload: Record<string, unknown> = {
          content,
          platforms: [target],
          isDraft: false,
          ...(input.scheduledFor ? { scheduledFor: input.scheduledFor, timezone } : { publishNow: true }),
          ...(mediaItems.length ? { mediaItems } : {}),
        };
        try {
          await request(`/posts/${encodeURIComponent(id)}`, apiKey, { method: "PUT", body: JSON.stringify(finalPayload) });
        } catch (error) {
          await request(`/posts/${encodeURIComponent(id)}`, apiKey, { method: "DELETE" }).catch(() => undefined);
          throw error;
        }
      }
      return { platform, postId: id } as const;
    } catch (error) {
      return { platform, error: error instanceof Error ? error.message : "Zernio post creation failed" } as const;
    }
  }));
  return {
    postIds: Object.fromEntries(results.flatMap((result) => "postId" in result ? [[result.platform, result.postId]] : [])) as Partial<Record<MarketingSocialPlatform, string>>,
    failures: results.flatMap((result) => "error" in result ? [{ platform: result.platform, error: result.error }] : []),
  };
}

export async function findZernioCompositionPosts(compositionId: string): Promise<Partial<Record<MarketingSocialPlatform, string>>> {
  const apiKey = process.env.ZERNIO_API_KEY?.trim();
  if (!apiKey) throw new MarketingProviderConfigError("ZERNIO_API_KEY is not configured");
  const body = await request("/posts?limit=200", apiKey);
  const posts = Array.isArray(body.posts) ? body.posts : [];
  const found: Partial<Record<MarketingSocialPlatform, string>> = {};
  for (const value of posts) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const post = value as Record<string, unknown>;
    const metadata = post.metadata && typeof post.metadata === "object" && !Array.isArray(post.metadata) ? post.metadata as Record<string, unknown> : null;
    if (metadata?.vizaCompositionId !== compositionId || typeof metadata.vizaPlatform !== "string") continue;
    const platform = metadata.vizaPlatform as MarketingSocialPlatform;
    if (!Object.hasOwn(ZERNIO_PLATFORM, platform) || found[platform]) continue;
    const id = typeof post._id === "string" ? post._id : typeof post.id === "string" ? post.id : null;
    if (id) found[platform] = id;
  }
  return found;
}

export async function getZernioPost(postId: string) {
  const apiKey = process.env.ZERNIO_API_KEY?.trim();
  if (!apiKey) throw new MarketingProviderConfigError("ZERNIO_API_KEY is not configured");
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(postId)) throw new Error("Invalid Zernio post id");
  return request(`/posts/${encodeURIComponent(postId)}`, apiKey);
}

export async function cancelZernioSchedule(postId: string) {
  const apiKey = process.env.ZERNIO_API_KEY?.trim();
  if (!apiKey) throw new MarketingProviderConfigError("ZERNIO_API_KEY is not configured");
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(postId)) throw new Error("Invalid Zernio post id");
  await request(`/posts/${encodeURIComponent(postId)}`, apiKey, { method: "PUT", body: JSON.stringify({ isDraft: true }) });
}

export async function deleteZernioPost(postId: string) {
  const apiKey = process.env.ZERNIO_API_KEY?.trim();
  if (!apiKey) throw new MarketingProviderConfigError("ZERNIO_API_KEY is not configured");
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(postId)) throw new Error("Invalid Zernio post id");
  await request(`/posts/${encodeURIComponent(postId)}`, apiKey, { method: "DELETE" });
}

export async function unpublishZernioPost(postId: string, platform: MarketingSocialPlatform) {
  const apiKey = process.env.ZERNIO_API_KEY?.trim();
  if (!apiKey) throw new MarketingProviderConfigError("ZERNIO_API_KEY is not configured");
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(postId)) throw new Error("Invalid Zernio post id");
  if (platform === "instagram") throw new Error("Instagram posts cannot be removed through the API; remove the post in Instagram");
  await request(`/posts/${encodeURIComponent(postId)}/unpublish`, apiKey, { method: "POST", body: JSON.stringify({ platform: ZERNIO_PLATFORM[platform] }) });
}

function finite(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function fetchZernioAnalytics(limit = 100): Promise<MarketingSocialAnalytics> {
  const apiKey = process.env.ZERNIO_API_KEY?.trim();
  if (!apiKey) return { connected: false, postCount: 0, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, views: 0, follows: 0, engagementRate: 0, lastSync: null };
  const body = await request(`/analytics?limit=${Math.min(100, Math.max(1, limit))}`, apiKey);
  const posts = Array.isArray(body.posts) ? body.posts : [];
  const totals = { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, views: 0, follows: 0 };
  let weightedEngagement = 0;
  let lastSync: string | null = null;
  for (const value of posts) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const firstPlatform = Array.isArray(row.platforms) && row.platforms[0] && typeof row.platforms[0] === "object" ? row.platforms[0] as Record<string, unknown> : null;
    const metrics = row.analytics && typeof row.analytics === "object" && !Array.isArray(row.analytics) ? row.analytics as Record<string, unknown> : firstPlatform?.analytics && typeof firstPlatform.analytics === "object" && !Array.isArray(firstPlatform.analytics) ? firstPlatform.analytics as Record<string, unknown> : {};
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) totals[key] += finite(metrics[key]);
    weightedEngagement += finite(metrics.engagementRate);
    if (typeof metrics.lastUpdated === "string" && (!lastSync || metrics.lastUpdated > lastSync)) lastSync = metrics.lastUpdated;
  }
  return { connected: true, postCount: posts.length, ...totals, engagementRate: posts.length ? weightedEngagement / posts.length : 0, lastSync };
}

export const ZERNIO_ACCOUNT_ENV_NAMES = ACCOUNT_ENV;

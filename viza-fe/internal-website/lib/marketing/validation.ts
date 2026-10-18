import {
  MARKETING_BLOG_LOCALES,
  MARKETING_SOCIAL_PLATFORMS,
  VIZA_VIDEO_PLATFORMS,
  type MarketingBlogDraftInput,
  type MarketingBlogAdminRecord,
  type MarketingBlogFaq,
  type MarketingBlogLocale,
  type MarketingSocialCompositionInput,
  type MarketingSocialPlatform,
} from "./contracts";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOCIAL_LIMITS: Record<MarketingSocialPlatform, number> = {
  x: 280,
  "google-business-sg": 1_500,
  instagram: 2_200,
  linkedin: 3_000,
  facebook: 5_000,
  pinterest: 500,
  reddit: 10_000,
  // TikTok's video caption limit.
  tiktok: 2_200,
  // A YouTube description; the title is separate (YOUTUBE_TITLE_LIMIT).
  youtube: 5_000,
};

/* Past these counts the platform refuses the post (Instagram) or silently
   drops every hashtag on it (YouTube, above 15). */
const HASHTAG_LIMITS: Partial<Record<MarketingSocialPlatform, number>> = {
  instagram: 30,
  youtube: 15,
};
const YOUTUBE_TITLE_LIMIT = 100;
const MAX_SCHEDULE_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

export function countHashtags(text: string): number {
  return text.match(/(^|\s)#[^\s#]+/g)?.length ?? 0;
}

/** The caption rules every provider path shares: length, then hashtag count. */
export function assertSocialCaption(platform: MarketingSocialPlatform, caption: string): void {
  if (caption.length > SOCIAL_LIMITS[platform]) throw new Error(`${platform} content must be ${SOCIAL_LIMITS[platform]} characters or fewer`);
  const hashtagLimit = HASHTAG_LIMITS[platform];
  if (hashtagLimit !== undefined && countHashtags(caption) > hashtagLimit) {
    throw new Error(`${platform} content can carry at most ${hashtagLimit} hashtags`);
  }
}

export function isVizaVideoPlatform(value: MarketingSocialPlatform): value is (typeof VIZA_VIDEO_PLATFORMS)[number] {
  return (VIZA_VIDEO_PLATFORMS as readonly string[]).includes(value);
}

export function normalizeMarketingSlug(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function isMarketingBlogLocale(value: unknown): value is MarketingBlogLocale {
  return typeof value === "string" && MARKETING_BLOG_LOCALES.includes(value as MarketingBlogLocale);
}

export function isMarketingSocialPlatform(value: unknown): value is MarketingSocialPlatform {
  return typeof value === "string" && MARKETING_SOCIAL_PLATFORMS.includes(value as MarketingSocialPlatform);
}

function optionalHttpsUrl(value: string | undefined, label: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL`);
  }
  if (url.protocol !== "https:") throw new Error(`${label} must be a valid HTTPS URL`);
  return url.toString();
}

function requiredText(value: string, label: string, max: number): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  if (trimmed.length > max) throw new Error(`${label} must be ${max} characters or fewer`);
  return trimmed;
}

export function validateBlogDraft(input: MarketingBlogDraftInput): MarketingBlogDraftInput {
  if (input.id && !UUID_PATTERN.test(input.id)) throw new Error("Invalid blog post id");
  if (!isMarketingBlogLocale(input.locale)) throw new Error("Unsupported blog locale");
  const slug = input.slug.trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug) || slug.length > 120) throw new Error("Slug must use lowercase letters, numbers, and single hyphens");
  return {
    ...input,
    slug,
    title: requiredText(input.title, "Title", 180),
    excerpt: requiredText(input.excerpt, "Excerpt", 500),
    bodyMarkdown: requiredText(input.bodyMarkdown, "Body", 100_000),
    authorName: requiredText(input.authorName, "Author", 120),
    reason: requiredText(input.reason, "Reason", 500),
    coverImageUrl: optionalHttpsUrl(input.coverImageUrl, "Cover image URL"),
    category: input.category?.trim().slice(0, 120) || undefined,
    seoTitle: input.seoTitle?.trim().slice(0, 180) || undefined,
    seoDescription: input.seoDescription?.trim().slice(0, 500) || undefined,
    topics: Array.isArray(input.topics) ? [...new Set(input.topics.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 80)).filter(Boolean))].slice(0, 6) : [],
    seoKeyword: typeof input.seoKeyword === "string" ? input.seoKeyword.trim().slice(0, 120) || undefined : undefined,
    faqs: cleanBlogFaqs(input.faqs),
  };
}

export function validatePublishableBlog(post: MarketingBlogAdminRecord): void {
  if (post.bodyMarkdown.trim().length < 300) throw new Error("Article needs at least 300 characters before publication");
  if (!post.category?.trim()) throw new Error("Choose a category before publication");
  if (!post.seoTitle?.trim() || !post.seoDescription?.trim()) throw new Error("SEO title and description are required before publication");
  if (post.editorial.sourceUrl && !post.bodyMarkdown.includes(post.editorial.sourceUrl)) throw new Error("Article must retain its source link");
  if (post.generationBrief && !post.coverImageUrl) throw new Error("Add a reviewed cover image before publishing an AI draft");
  if (post.bodyMarkdown.includes("—")) throw new Error("Replace em dashes before publication");
}

export function parseGeneratedPlatformContent(value: unknown, platforms: readonly MarketingSocialPlatform[]): Partial<Record<MarketingSocialPlatform, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Provider returned invalid platform content");
  const content = value as Record<string, unknown>;
  return Object.fromEntries(platforms.map((platform) => {
    const caption = content[platform];
    if (typeof caption !== "string" || !caption.trim()) throw new Error(`Provider returned invalid ${platform} copy`);
    const trimmed = caption.trim();
    assertSocialCaption(platform, trimmed);
    return [platform, trimmed];
  })) as Partial<Record<MarketingSocialPlatform, string>>;
}

export function validateSocialComposition(input: MarketingSocialCompositionInput): MarketingSocialCompositionInput {
  if (input.id && !UUID_PATTERN.test(input.id)) throw new Error("Invalid composition id");
  if (input.blogPostId && !UUID_PATTERN.test(input.blogPostId)) throw new Error("Invalid blog post id");
  const platforms = [...new Set(input.platforms)];
  if (!platforms.length || platforms.some((platform) => !isMarketingSocialPlatform(platform))) {
    throw new Error("Select at least one supported social platform");
  }
  for (const platform of platforms) {
    const content = input.platformContent[platform]?.trim();
    if (!content) throw new Error(`Content is required for ${platform}`);
    assertSocialCaption(platform, content);
  }
  const videoUrl = optionalHttpsUrl(input.videoUrl, "Video URL");
  let videoTitle: string | undefined;
  if (videoUrl) {
    /* A short is its own composition: the feed and image channels keep
       theirs, so one approval never mixes a Reel with a Pinterest pin. */
    const others = platforms.filter((platform) => !isVizaVideoPlatform(platform));
    if (others.length) throw new Error(`A short posts to TikTok, Instagram Reels and YouTube Shorts only; move ${others.join(", ")} to the article's caption composition`);
    if (!isMarketingBlogLocale(input.videoLocale)) throw new Error("Choose the language the short is spoken in");
    if (platforms.includes("youtube")) {
      videoTitle = requiredText(input.videoTitle ?? "", "YouTube title", YOUTUBE_TITLE_LIMIT);
      if (/[<>]/.test(videoTitle)) throw new Error("YouTube titles cannot contain < or >");
    } else {
      videoTitle = input.videoTitle?.trim().slice(0, YOUTUBE_TITLE_LIMIT) || undefined;
    }
  } else {
    if (platforms.includes("tiktok") || platforms.includes("youtube")) throw new Error("TikTok and YouTube Shorts need a video; attach the rendered short");
    if ((platforms.includes("instagram") || platforms.includes("pinterest")) && !input.mediaUrl?.trim()) {
      throw new Error("A media URL is required for Instagram and Pinterest");
    }
  }
  let scheduledFor: string | undefined;
  if (input.scheduledFor) {
    if (!videoUrl && (platforms.includes("instagram") || platforms.includes("pinterest"))) throw new Error("Instagram and Pinterest posts publish when approved; remove the scheduled time");
    const timestamp = Date.parse(input.scheduledFor);
    if (!Number.isFinite(timestamp)) throw new Error("Scheduled time is invalid");
    // Upload-Post holds a scheduled video for up to a year.
    if (videoUrl && timestamp - Date.now() > MAX_SCHEDULE_AHEAD_MS) throw new Error("Shorts can be scheduled up to a year ahead");
    scheduledFor = new Date(timestamp).toISOString();
  }
  return {
    ...input,
    platforms,
    title: requiredText(input.title, "Title", 180),
    brief: requiredText(input.brief, "Brief", 4_000),
    reason: requiredText(input.reason, "Reason", 500),
    destinationUrl: optionalHttpsUrl(input.destinationUrl, "Destination URL"),
    mediaUrl: optionalHttpsUrl(input.mediaUrl, "Media URL"),
    documentUrl: optionalHttpsUrl(input.documentUrl, "Document URL"),
    videoUrl,
    videoLocale: videoUrl ? input.videoLocale : undefined,
    videoTitle,
    scheduledFor,
    platformContent: Object.fromEntries(platforms.map((platform) => [platform, input.platformContent[platform]!.trim()])),
  };
}

/* An FAQ needs both halves to be worth publishing: a half-filled pair would
   reach the marketing site as an empty accordion row and as invalid FAQPage
   data. Drop those rather than reject the save, so a reviewer can leave a row
   half-typed while they work. */
export function cleanBlogFaqs(value: unknown): MarketingBlogFaq[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const faq = entry as Record<string, unknown>;
      const question = typeof faq.question === "string" ? faq.question.trim().slice(0, 200) : "";
      const answer = typeof faq.answer === "string" ? faq.answer.trim().slice(0, 1_000) : "";
      return question && answer ? { question, answer } : null;
    })
    .filter((faq): faq is MarketingBlogFaq => faq !== null)
    .slice(0, 10);
}

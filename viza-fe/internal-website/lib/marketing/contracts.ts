export const MARKETING_BLOG_LOCALES = ["en", "zh-CN"] as const;
export type MarketingBlogLocale = (typeof MARKETING_BLOG_LOCALES)[number];

export const MARKETING_SOCIAL_PLATFORMS = [
  "x",
  "google-business-sg",
  "instagram",
  "linkedin",
  "facebook",
  "pinterest",
  "reddit",
  "tiktok",
  "youtube",
] as const;
export type MarketingSocialPlatform = (typeof MARKETING_SOCIAL_PLATFORMS)[number];
export const VIZA_CONTENT_PLATFORMS = ["linkedin", "facebook", "instagram", "pinterest"] as const satisfies readonly MarketingSocialPlatform[];
/** Channels for a vertical short. Instagram here means a Reel, YouTube means a Short. */
export const VIZA_VIDEO_PLATFORMS = ["tiktok", "instagram", "youtube"] as const satisfies readonly MarketingSocialPlatform[];
export type VizaVideoPlatform = (typeof VIZA_VIDEO_PLATFORMS)[number];
/** Every channel Upload-Post delivers to; the rest go through Zernio. */
export const UPLOAD_POST_PLATFORMS = ["instagram", "pinterest", "tiktok", "youtube"] as const satisfies readonly MarketingSocialPlatform[];
export type UploadPostPlatform = (typeof UPLOAD_POST_PLATFORMS)[number];

/* One Upload-Post delivery. `requestId` tracks an immediate upload, `jobId` a
   post Upload-Post holds until its scheduled time. */
export interface UploadPostDelivery {
  status: "scheduled" | "pending" | "published" | "failed";
  requestId: string | null;
  jobId?: string | null;
  postId: string | null;
  postUrl: string | null;
  error?: string | null;
}

/** One question and its answer, shown under the article and published as
    FAQPage structured data. */
export interface MarketingBlogFaq {
  question: string;
  answer: string;
}

export interface MarketingBlogSummary {
  id: string;
  locale: MarketingBlogLocale;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  category: string | null;
  authorName: string;
  publishedAt: string;
}

export interface MarketingBlogPost extends MarketingBlogSummary {
  bodyMarkdown: string;
  seoTitle: string | null;
  seoDescription: string | null;
  faqs: MarketingBlogFaq[];
  updatedAt: string;
}

export interface MarketingBlogAdminRecord {
  id: string;
  locale: MarketingBlogLocale;
  slug: string;
  status: "draft" | "published" | "archived";
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  coverImageUrl: string | null;
  category: string | null;
  authorName: string;
  seoTitle: string | null;
  seoDescription: string | null;
  editorial: { sourceUrl: string | null; topics: string[]; seoKeyword: string | null; keywordMeasured: boolean; monthlySearches: number | null; rankScore: number | null; faqs: MarketingBlogFaq[] };
  generationBrief: string | null;
  generatedByModel: string | null;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingBlogFeed {
  posts: MarketingBlogSummary[];
  generatedAt: string;
}

export interface MarketingAnalyticsOverview {
  connected: {
    ga4: boolean;
    searchConsole: boolean;
  };
  windowDays: number;
  totalUsers: number | null;
  sessions: number | null;
  pageViews: number | null;
  conversions: number | null;
  searchClicks: number | null;
  searchImpressions: number | null;
  dailyUsers: Array<{ date: string; users: number }>;
  topCountries: Array<{ country: string; users: number }>;
}

export interface MarketingProviderReadiness {
  openrouter: { connected: boolean; model: string | null };
  zernio: {
    connected: boolean;
    configuredPlatforms: MarketingSocialPlatform[];
    missingPlatforms: MarketingSocialPlatform[];
  };
  /* Shorts go out private (TikTok "only me", YouTube private) until
     UPLOAD_POST_VIDEO_VISIBILITY=public is set for the confirmed accounts. */
  uploadPost: { connected: boolean; videoVisibility: "private" | "public" };
  ga4: { connected: boolean };
  searchConsole: { connected: boolean };
}

export interface MarketingSocialCompositionRecord {
  id: string;
  blogPostId: string | null;
  shortLinkId: string | null;
  title: string;
  brief: string;
  destinationUrl: string | null;
  mediaUrl: string | null;
  documentUrl: string | null;
  /** Set on a short-video composition; its platforms are VIZA_VIDEO_PLATFORMS. */
  videoUrl: string | null;
  videoLocale: MarketingBlogLocale | null;
  videoTitle: string | null;
  status: "draft" | "scheduled" | "publishing" | "published" | "partial" | "failed" | "cancelled";
  platforms: MarketingSocialPlatform[];
  platformContent: Partial<Record<MarketingSocialPlatform, string>>;
  zernioPosts: Partial<Record<MarketingSocialPlatform, string>>;
  zernioPostUrls: Partial<Record<MarketingSocialPlatform, string>>;
  uploadPostPosts: Partial<Record<UploadPostPlatform, UploadPostDelivery>>;
  scheduledFor: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingSocialAnalytics {
  connected: boolean;
  postCount: number;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  views: number;
  follows: number;
  engagementRate: number;
  lastSync: string | null;
}

export interface MarketingShortLinkRecord {
  id: string;
  code: string;
  destinationUrl: string;
  source: string;
  campaign: string | null;
  contentKey: string | null;
  active: boolean;
  clickCount: number;
  lastClickedAt: string | null;
  createdAt: string;
}

export interface MarketingAutomationRunRecord {
  id: string;
  jobType: string;
  idempotencyKey: string;
  status: "running" | "succeeded" | "failed" | "skipped";
  outputEntityId: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface MarketingOperationsDashboard {
  analytics: MarketingAnalyticsOverview;
  socialAnalytics: MarketingSocialAnalytics;
  providers: MarketingProviderReadiness;
  recentPosts: MarketingBlogAdminRecord[];
  recentSocial: MarketingSocialCompositionRecord[];
  recentAutomation: MarketingAutomationRunRecord[];
}

export interface MarketingActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface MarketingBlogDraftInput {
  id?: string;
  expectedVersion?: number;
  locale: MarketingBlogLocale;
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  coverImageUrl?: string;
  category?: string;
  authorName: string;
  seoTitle?: string;
  seoDescription?: string;
  topics?: string[];
  seoKeyword?: string;
  faqs?: MarketingBlogFaq[];
  reason: string;
}

export interface MarketingSocialCompositionInput {
  id?: string;
  blogPostId?: string;
  title: string;
  brief: string;
  destinationUrl?: string;
  trackDestination?: boolean;
  mediaUrl?: string;
  documentUrl?: string;
  videoUrl?: string;
  videoLocale?: MarketingBlogLocale;
  videoTitle?: string;
  platforms: MarketingSocialPlatform[];
  platformContent: Partial<Record<MarketingSocialPlatform, string>>;
  scheduledFor?: string;
  reason: string;
}

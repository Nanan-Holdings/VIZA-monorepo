export const MARKETING_BLOG_LOCALES = ["en", "zh-CN"] as const;
export type MarketingBlogLocale = (typeof MARKETING_BLOG_LOCALES)[number];

export const MARKETING_SOCIAL_PLATFORMS = [
  "x",
  "google-business-sg",
  "instagram",
  "linkedin",
  "pinterest",
  "reddit",
] as const;
export type MarketingSocialPlatform = (typeof MARKETING_SOCIAL_PLATFORMS)[number];

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
  status: "draft" | "scheduled" | "publishing" | "published" | "partial" | "failed" | "cancelled";
  platforms: MarketingSocialPlatform[];
  platformContent: Partial<Record<MarketingSocialPlatform, string>>;
  zernioPosts: Partial<Record<MarketingSocialPlatform, string>>;
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
  platforms: MarketingSocialPlatform[];
  platformContent: Partial<Record<MarketingSocialPlatform, string>>;
  scheduledFor?: string;
  reason: string;
}

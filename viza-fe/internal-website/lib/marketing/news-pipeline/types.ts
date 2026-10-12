export interface NewsStory {
  url: string;
  title: string;
  source: string;
  feed: string;
  summary: string;
  publishedAt: string | null;
}

export interface NewsScanConfig {
  searchQueries: string[];
  tradeFeeds: Array<{ name: string; url: string }>;
  subreddits: string[];
  maxAgeDays: number;
  maxPerFeed: number;
  /** Google News region and language, for example `SG:en`. */
  googleNewsEdition: string;
}

export interface NewsScanResult {
  items: NewsStory[];
  feedErrors: string[];
}

export interface RankedNewsStory {
  story: NewsStory;
  score: number;
  reason: string;
}

export interface ReadableNewsStory {
  url: string;
  text: string;
  coverImageUrl: string | null;
}

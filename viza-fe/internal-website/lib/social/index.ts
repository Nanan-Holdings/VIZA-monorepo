/* Vendored from Kelin-Studio/kelin-social@9cf1e11 (src/index.ts). Edit there and re-sync. */
/* kelin-social: posting to our own accounts without a middleman.

   Source of truth: Kelin-Studio/kelin-social. Each pipeline carries a copy of
   src/ (scripts/sync.sh), so edit here and re-sync rather than editing a copy.

   One app is one brand, so the credentials are plain environment variables:

     KELIN_FACEBOOK_PAGE_ID, KELIN_FACEBOOK_PAGE_TOKEN   Facebook Page
     KELIN_INSTAGRAM_USER_ID                             Instagram (uses the Page token)
     KELIN_THREADS_USER_ID, KELIN_THREADS_TOKEN          Threads
     KELIN_X_CONSUMER_KEY, KELIN_X_CONSUMER_SECRET,
     KELIN_X_ACCESS_TOKEN, KELIN_X_ACCESS_SECRET,
     KELIN_X_USERNAME                                    X
     KELIN_LINKEDIN_ORG_ID, and either KELIN_LINKEDIN_TOKEN
       or KELIN_LINKEDIN_REFRESH_TOKEN + KELIN_LINKEDIN_CLIENT_ID
       + KELIN_LINKEDIN_CLIENT_SECRET                    LinkedIn company page
     KELIN_LINKEDIN_VERSION                              optional, default in linkedin.ts
     KELIN_PINTEREST_BOARD_ID, KELIN_PINTEREST_REFRESH_TOKEN,
       KELIN_PINTEREST_CLIENT_ID, KELIN_PINTEREST_CLIENT_SECRET,
       KELIN_PINTEREST_API (optional host)               Pinterest board
     KELIN_REDDIT_CLIENT_ID, KELIN_REDDIT_CLIENT_SECRET,
       KELIN_REDDIT_REFRESH_TOKEN, KELIN_REDDIT_USERNAME,
       KELIN_REDDIT_SUBREDDIT (optional default)         Reddit account
     KELIN_TIKTOK_CLIENT_KEY, KELIN_TIKTOK_CLIENT_SECRET,
       KELIN_TIKTOK_REFRESH_TOKEN, KELIN_TIKTOK_PRIVACY  TikTok account
     KELIN_YOUTUBE_CLIENT_ID, KELIN_YOUTUBE_CLIENT_SECRET,
       KELIN_YOUTUBE_REFRESH_TOKEN, KELIN_YOUTUBE_PRIVACY YouTube channel
     META_GRAPH_VERSION                                  optional, default in meta.ts */
import { defaultHttp, type Http } from "./http";
import { facebookPage, instagram } from "./meta";
import { linkedinPage } from "./linkedin";
import { pinterestBoard } from "./pinterest";
import { redditAccount } from "./reddit";
import { tiktokAccount } from "./tiktok";
import { youtubeChannel } from "./youtube";
import { threads } from "./threads";
import { xAccount } from "./x";
import { SocialError, type Adapter, type Network } from "./types";

export * from "./types";
export { refreshThreadsToken } from "./threads";
export { youtubeTitle, YOUTUBE_TITLE_LIMIT } from "./youtube";
export { escapeLittleText } from "./linkedin";

type Env = Record<string, string | undefined>;

const REQUIRED: Record<Network, string[]> = {
  facebook: ["KELIN_FACEBOOK_PAGE_ID", "KELIN_FACEBOOK_PAGE_TOKEN"],
  instagram: ["KELIN_FACEBOOK_PAGE_TOKEN", "KELIN_INSTAGRAM_USER_ID"],
  threads: ["KELIN_THREADS_USER_ID", "KELIN_THREADS_TOKEN"],
  x: ["KELIN_X_CONSUMER_KEY", "KELIN_X_CONSUMER_SECRET", "KELIN_X_ACCESS_TOKEN", "KELIN_X_ACCESS_SECRET", "KELIN_X_USERNAME"],
  linkedin: ["KELIN_LINKEDIN_ORG_ID"],
  pinterest: ["KELIN_PINTEREST_BOARD_ID", "KELIN_PINTEREST_REFRESH_TOKEN", "KELIN_PINTEREST_CLIENT_ID", "KELIN_PINTEREST_CLIENT_SECRET"],
  reddit: ["KELIN_REDDIT_CLIENT_ID", "KELIN_REDDIT_CLIENT_SECRET", "KELIN_REDDIT_REFRESH_TOKEN", "KELIN_REDDIT_USERNAME"],
  tiktok: ["KELIN_TIKTOK_CLIENT_KEY", "KELIN_TIKTOK_CLIENT_SECRET", "KELIN_TIKTOK_REFRESH_TOKEN"],
  youtube: ["KELIN_YOUTUBE_CLIENT_ID", "KELIN_YOUTUBE_CLIENT_SECRET", "KELIN_YOUTUBE_REFRESH_TOKEN"],
};

const LINKEDIN_REFRESH = ["KELIN_LINKEDIN_REFRESH_TOKEN", "KELIN_LINKEDIN_CLIENT_ID", "KELIN_LINKEDIN_CLIENT_SECRET"];

const v = (env: Env, key: string) => env[key]?.trim() || "";

/** The variables a network still lacks, empty when it is ready to post. */
export function missingConfig(network: Network, env: Env = process.env): string[] {
  const missing = REQUIRED[network].filter((k) => !v(env, k));
  /* LinkedIn takes a plain access token or the refresh trio, whichever is set. */
  if (network === "linkedin" && !v(env, "KELIN_LINKEDIN_TOKEN")) {
    const lacking = LINKEDIN_REFRESH.filter((k) => !v(env, k));
    if (lacking.length) missing.push(lacking.length === LINKEDIN_REFRESH.length ? "KELIN_LINKEDIN_TOKEN (or the refresh token trio)" : lacking.join(", "));
  }
  return missing;
}

export function isConfigured(network: Network, env: Env = process.env): boolean {
  return missingConfig(network, env).length === 0;
}

export function adapterFor(network: Network, env: Env = process.env, http: Http = defaultHttp): Adapter {
  const missing = missingConfig(network, env);
  if (missing.length) throw new SocialError(network, `not configured: set ${missing.join(", ")}`);
  const graphVersion = v(env, "META_GRAPH_VERSION") || undefined;
  switch (network) {
    case "facebook":
      return facebookPage({ pageId: v(env, "KELIN_FACEBOOK_PAGE_ID"), pageToken: v(env, "KELIN_FACEBOOK_PAGE_TOKEN"), graphVersion }, http);
    case "instagram":
      return instagram({
        pageId: v(env, "KELIN_FACEBOOK_PAGE_ID"),
        pageToken: v(env, "KELIN_FACEBOOK_PAGE_TOKEN"),
        instagramUserId: v(env, "KELIN_INSTAGRAM_USER_ID"),
        graphVersion,
      }, http);
    case "threads":
      return threads({ userId: v(env, "KELIN_THREADS_USER_ID"), token: v(env, "KELIN_THREADS_TOKEN") }, http);
    case "x":
      return xAccount({
        consumerKey: v(env, "KELIN_X_CONSUMER_KEY"),
        consumerSecret: v(env, "KELIN_X_CONSUMER_SECRET"),
        token: v(env, "KELIN_X_ACCESS_TOKEN"),
        tokenSecret: v(env, "KELIN_X_ACCESS_SECRET"),
        username: v(env, "KELIN_X_USERNAME").replace(/^@/, ""),
      }, http);
    case "linkedin":
      return linkedinPage({
        organizationId: v(env, "KELIN_LINKEDIN_ORG_ID"),
        accessToken: v(env, "KELIN_LINKEDIN_TOKEN") || undefined,
        refreshToken: v(env, "KELIN_LINKEDIN_REFRESH_TOKEN") || undefined,
        clientId: v(env, "KELIN_LINKEDIN_CLIENT_ID") || undefined,
        clientSecret: v(env, "KELIN_LINKEDIN_CLIENT_SECRET") || undefined,
        version: v(env, "KELIN_LINKEDIN_VERSION") || undefined,
      }, http);
    case "pinterest":
      return pinterestBoard({
        boardId: v(env, "KELIN_PINTEREST_BOARD_ID"),
        refreshToken: v(env, "KELIN_PINTEREST_REFRESH_TOKEN"),
        clientId: v(env, "KELIN_PINTEREST_CLIENT_ID"),
        clientSecret: v(env, "KELIN_PINTEREST_CLIENT_SECRET"),
        apiHost: v(env, "KELIN_PINTEREST_API") || undefined,
      }, http);
    case "reddit":
      return redditAccount({
        clientId: v(env, "KELIN_REDDIT_CLIENT_ID"),
        clientSecret: v(env, "KELIN_REDDIT_CLIENT_SECRET"),
        refreshToken: v(env, "KELIN_REDDIT_REFRESH_TOKEN"),
        username: v(env, "KELIN_REDDIT_USERNAME").replace(/^\/?u\//, ""),
        defaultSubreddit: v(env, "KELIN_REDDIT_SUBREDDIT") || undefined,
      }, http);
    case "tiktok":
      return tiktokAccount({
        clientKey: v(env, "KELIN_TIKTOK_CLIENT_KEY"),
        clientSecret: v(env, "KELIN_TIKTOK_CLIENT_SECRET"),
        refreshToken: v(env, "KELIN_TIKTOK_REFRESH_TOKEN"),
        privacy: v(env, "KELIN_TIKTOK_PRIVACY") || undefined,
      }, http);
    case "youtube":
      return youtubeChannel({
        clientId: v(env, "KELIN_YOUTUBE_CLIENT_ID"),
        clientSecret: v(env, "KELIN_YOUTUBE_CLIENT_SECRET"),
        refreshToken: v(env, "KELIN_YOUTUBE_REFRESH_TOKEN"),
        privacy: v(env, "KELIN_YOUTUBE_PRIVACY") || undefined,
      }, http);
  }
}

/* Pipelines store one handle per sent post, in a column that also holds
   vendor ids from before the cut-over. A prefix says which sender made it,
   so a takedown never sends a vendor's id to a network or the reverse. */
const PREFIX = "kelin:";

export function toHandle(network: Network, id: string): string {
  return `${PREFIX}${network}:${id}`;
}

export function fromHandle(handle: string | null | undefined): { network: Network; id: string } | null {
  if (!handle?.startsWith(PREFIX)) return null;
  const rest = handle.slice(PREFIX.length);
  const i = rest.indexOf(":");
  if (i < 1) return null;
  const network = rest.slice(0, i) as Network;
  if (!(network in REQUIRED)) return null;
  return { network, id: rest.slice(i + 1) };
}

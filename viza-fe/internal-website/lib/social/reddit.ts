/* Vendored from Kelin-Studio/kelin-social@9cf1e11 (src/reddit.ts). Edit there and re-sync. */
/* Reddit, through the Data API (oauth.reddit.com).

   Since Nov 2025 every new Data API app needs Reddit's approval before it
   can call the API (Responsible Builder Policy). The app is a "web app" so
   the account signs in once and we keep a permanent refresh token; access
   tokens last an hour and are swapped on first use.

   Reddit requires a descriptive User-Agent on every call. */
import { defaultHttp, form, requestJson, type Http } from "./http";
import { SocialError, type Adapter, type PostInput, type PostStatus, type Published } from "./types";

export const REDDIT_TITLE_LIMIT = 300;

export type RedditConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** The account posting, for the User-Agent. */
  username: string;
  /** Subreddit used when a post names none, without the r/. */
  defaultSubreddit?: string;
};

type Thing = { data?: { children?: Array<{ data?: { name?: string; permalink?: string; removed_by_category?: string | null; author?: string } }> } };

export function redditAccount(cfg: RedditConfig, http: Http = defaultHttp): Adapter {
  const userAgent = `web:kelin-social:0.1 (by /u/${cfg.username})`;
  let token = "";

  async function headers(): Promise<Record<string, string>> {
    if (!token) {
      const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
      const r = await requestJson<{ access_token: string }>(http, "reddit", "https://www.reddit.com/api/v1/access_token", {
        method: "POST",
        headers: { Authorization: `Basic ${basic}`, "User-Agent": userAgent },
        body: form({ grant_type: "refresh_token", refresh_token: cfg.refreshToken }),
      });
      token = r.access_token;
    }
    return { Authorization: `Bearer ${token}`, "User-Agent": userAgent };
  }

  async function info(id: string) {
    const r = await requestJson<Thing>(http, "reddit", `https://oauth.reddit.com/api/info?id=${encodeURIComponent(id)}`, { headers: await headers() });
    return r.data?.children?.[0]?.data;
  }

  return {
    network: "reddit",

    async publish(input: PostInput): Promise<Published> {
      const sr = (input.community || cfg.defaultSubreddit || "").replace(/^\/?r\//, "");
      if (!sr) throw new SocialError("reddit", "no subreddit: set one on the post or KELIN_REDDIT_SUBREDDIT");
      const title = (input.title || input.text.split("\n")[0]).slice(0, REDDIT_TITLE_LIMIT);
      const r = await requestJson<{ json?: { errors?: string[][]; data?: { name?: string; url?: string } } }>(
        http, "reddit", "https://oauth.reddit.com/api/submit",
        {
          method: "POST",
          headers: await headers(),
          body: form({
            api_type: "json", sr, title, resubmit: "true",
            ...(input.link ? { kind: "link", url: input.link } : { kind: "self", text: input.text }),
          }),
        },
      );
      const errors = r.json?.errors ?? [];
      if (errors.length) throw new SocialError("reddit", errors.map((e) => e.join(": ")).join("; "), 400, false, errors[0]?.[0] ?? null);
      const name = r.json?.data?.name;
      if (!name) throw new SocialError("reddit", "Reddit returned no post id");
      return { id: name, url: r.json?.data?.url ?? null };
    },

    async status(id: string): Promise<PostStatus> {
      const d = await info(id);
      if (!d || d.author === "[deleted]") return { state: "gone", url: null };
      const url = d.permalink ? `https://www.reddit.com${d.permalink}` : null;
      if (d.removed_by_category) return { state: "failed", url, detail: `removed by ${d.removed_by_category}` };
      return { state: "live", url };
    },

    async remove(id: string): Promise<void> {
      await requestJson(http, "reddit", "https://oauth.reddit.com/api/del", { method: "POST", headers: await headers(), body: form({ id }) });
    },
  };
}

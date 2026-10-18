/* Vendored from Kelin-Studio/kelin-social@9cf1e11 (src/x.ts). Edit there and re-sync. */
/* X, through the v2 API on pay-per-use credits.

   Pricing as of Oct 2026: $0.015 a post, $0.20 a post that contains a URL,
   $0.01 a delete, $0.005 a post read. An empty balance answers 402, which is
   reported as such rather than as a broken post. Every pipeline post carries
   the blog link, so budget at the URL rate. */
import { defaultHttp, requestJson, type Http } from "./http";
import { authorizationHeader, type OAuth1Credentials } from "./oauth1";
import { SocialError, type Adapter, type PostInput, type PostStatus, type Published } from "./types";

const API = "https://api.x.com/2";
export const X_TEXT_LIMIT = 280;

export type XConfig = OAuth1Credentials & {
  /** The @handle without the @, for building post addresses. */
  username: string;
};

function explain(err: unknown): never {
  if (err instanceof SocialError && err.status === 402) {
    throw new SocialError("x", "the X API credit balance is empty. Top up pay-per-use credits in the X developer console", 402, false, "credits");
  }
  throw err;
}

export function xAccount(cfg: XConfig, http: Http = defaultHttp): Adapter {
  const sign = (method: string, url: string) => authorizationHeader(method, url, cfg);

  async function uploadImage(imageUrl: string): Promise<string> {
    const img = await http.fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
    if (!img.ok) throw new SocialError("x", `could not fetch the image (${img.status})`);
    const type = img.headers.get("content-type") ?? "image/jpeg";
    const body = new FormData();
    body.set("media", new Blob([await img.arrayBuffer()], { type }), "cover");
    body.set("media_category", "tweet_image");
    const url = `${API}/media/upload`;
    const r = await requestJson<{ data?: { id?: string } }>(http, "x", url, {
      method: "POST",
      headers: { Authorization: sign("POST", url) },
      body,
    }, 60000).catch(explain);
    const id = r.data?.id;
    if (!id) throw new SocialError("x", "media upload returned no id");
    return id;
  }

  return {
    network: "x",

    async publish(input: PostInput): Promise<Published> {
      if ([...input.text].length > X_TEXT_LIMIT) {
        throw new SocialError("x", `the text is over ${X_TEXT_LIMIT} characters`);
      }
      const mediaId = input.imageUrl ? await uploadImage(input.imageUrl) : null;
      const url = `${API}/tweets`;
      const r = await requestJson<{ data?: { id?: string } }>(http, "x", url, {
        method: "POST",
        headers: { Authorization: sign("POST", url), "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.text, ...(mediaId ? { media: { media_ids: [mediaId] } } : {}) }),
      }).catch(explain);
      const id = r.data?.id;
      if (!id) throw new SocialError("x", "X returned no post id");
      return { id, url: `https://x.com/${cfg.username}/status/${id}` };
    },

    async status(id: string): Promise<PostStatus> {
      const url = `${API}/tweets/${encodeURIComponent(id)}`;
      try {
        const r = await requestJson<{ data?: { id: string }; errors?: unknown[] }>(http, "x", url, {
          headers: { Authorization: sign("GET", url) },
        });
        /* X answers a deleted post with 200 and an errors array, no data. */
        if (!r.data) return { state: "gone", url: null };
        return { state: "live", url: `https://x.com/${cfg.username}/status/${id}` };
      } catch (err) {
        if (err instanceof SocialError && err.status === 404) return { state: "gone", url: null };
        return explain(err);
      }
    },

    async remove(id: string): Promise<void> {
      const url = `${API}/tweets/${encodeURIComponent(id)}`;
      try {
        await requestJson(http, "x", url, { method: "DELETE", headers: { Authorization: sign("DELETE", url) } });
      } catch (err) {
        if (err instanceof SocialError && err.status === 404) return;
        explain(err);
      }
    },
  };
}

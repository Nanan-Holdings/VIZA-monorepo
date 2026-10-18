/* Vendored from Kelin-Studio/kelin-social@9cf1e11 (src/linkedin.ts). Edit there and re-sync. */
/* LinkedIn company pages, through the Community Management API (Posts API).

   Kelin's app 253160230 has Development Tier access since 17 Aug 2026:
   500 calls an app a day, 100 a member a day, `w_organization_social`.
   The member whose token this is must be an admin of the page.

   Access tokens last 60 days. With a refresh token (365 days) and the app's
   client id and secret, the adapter swaps for a fresh access token on first
   use and keeps it for the life of the process, so only the refresh token
   needs replacing, once a year. */
import { defaultHttp, form, requestJson, sleep, type Http } from "./http";
import { SocialError, type Adapter, type PostInput, type PostStatus, type Published } from "./types";

const API = "https://api.linkedin.com/rest";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
/** LinkedIn versions its API by month and retires each version after a year. */
export const LINKEDIN_DEFAULT_VERSION = "202609";
export const LINKEDIN_TEXT_LIMIT = 3000;

export type LinkedInConfig = {
  organizationId: string;
  /** Either an access token, or a refresh token with the app's credentials. */
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  version?: string;
};

/* Commentary is "little text": these characters are markup unless escaped,
   and an unescaped one can cut the post short at that point. */
export function escapeLittleText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
}

const postUrl = (urn: string) => `https://www.linkedin.com/feed/update/${urn}/`;

export function linkedinPage(cfg: LinkedInConfig, http: Http = defaultHttp): Adapter {
  const author = `urn:li:organization:${cfg.organizationId}`;
  let token = cfg.accessToken || "";
  let refreshed = false;

  async function accessToken(): Promise<string> {
    if (cfg.refreshToken && cfg.clientId && cfg.clientSecret && !refreshed) {
      const r = await requestJson<{ access_token: string }>(http, "linkedin", TOKEN_URL, {
        method: "POST",
        body: form({
          grant_type: "refresh_token",
          refresh_token: cfg.refreshToken,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
        }),
      });
      token = r.access_token;
      refreshed = true;
    }
    if (!token) throw new SocialError("linkedin", "no access token: set KELIN_LINKEDIN_TOKEN or the refresh-token trio");
    return token;
  }

  async function headers(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${await accessToken()}`,
      "LinkedIn-Version": cfg.version || LINKEDIN_DEFAULT_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      ...extra,
    };
  }

  async function uploadImage(imageUrl: string): Promise<string> {
    const img = await http.fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
    if (!img.ok) throw new SocialError("linkedin", `could not fetch the image (${img.status})`);
    const bytes = await img.arrayBuffer();
    const init = await requestJson<{ value?: { uploadUrl?: string; image?: string } }>(
      http, "linkedin", `${API}/images?action=initializeUpload`,
      {
        method: "POST",
        headers: await headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
      },
    );
    const uploadUrl = init.value?.uploadUrl;
    const urn = init.value?.image;
    if (!uploadUrl || !urn) throw new SocialError("linkedin", "image upload returned no address");
    const put = await http.fetch(uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": img.headers.get("content-type") ?? "image/jpeg" },
      body: bytes,
      signal: AbortSignal.timeout(60000),
    });
    if (!put.ok) throw new SocialError("linkedin", `image upload failed (${put.status})`, put.status, put.status >= 500);
    /* The image is usable once LinkedIn has processed it, usually at once. */
    for (let i = 0; i < 10; i++) {
      const s = await requestJson<{ status?: string }>(http, "linkedin", `${API}/images/${encodeURIComponent(urn)}`, {
        headers: await headers(),
      });
      if (s.status === "AVAILABLE") break;
      if (s.status === "PROCESSING_FAILED") throw new SocialError("linkedin", "LinkedIn could not process the image");
      await sleep(http.pollMs);
    }
    return urn;
  }

  return {
    network: "linkedin",

    async publish(input: PostInput): Promise<Published> {
      if (input.text.length > LINKEDIN_TEXT_LIMIT) {
        throw new SocialError("linkedin", `the text is ${input.text.length} characters, LinkedIn takes ${LINKEDIN_TEXT_LIMIT}`);
      }
      const imageUrn = input.imageUrl ? await uploadImage(input.imageUrl) : null;
      /* A link becomes an article card, with the picture as its thumbnail.
         LinkedIn does not scrape the page, so the card shows what we send. */
      const content = input.link
        ? {
            article: {
              source: input.link,
              title: (input.title || input.text.split("\n")[0]).slice(0, 200),
              ...(imageUrn ? { thumbnail: imageUrn } : {}),
            },
          }
        : imageUrn
          ? { media: { id: imageUrn } }
          : undefined;
      const res = await http.fetch(`${API}/posts`, {
        method: "POST",
        headers: await headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          author,
          commentary: escapeLittleText(input.text),
          visibility: "PUBLIC",
          distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
          ...(content ? { content } : {}),
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        }),
        signal: AbortSignal.timeout(30000),
      }).catch((err) => {
        throw new SocialError("linkedin", `no answer (${err instanceof Error ? err.message : String(err)})`, null, true);
      });
      if (!res.ok) {
        const raw = await res.text();
        let message = raw.slice(0, 300) || "request failed";
        try {
          const b = JSON.parse(raw) as { message?: string };
          if (b.message) message = b.message;
        } catch {
          /* Keep the text. */
        }
        throw new SocialError("linkedin", message, res.status, res.status === 429 || res.status >= 500);
      }
      /* The new post's URN comes back in a header, the body is empty. */
      const urn = res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id");
      if (!urn) throw new SocialError("linkedin", "LinkedIn returned no post id");
      return { id: urn, url: postUrl(urn) };
    },

    async status(id: string): Promise<PostStatus> {
      try {
        const r = await requestJson<{ lifecycleState?: string }>(http, "linkedin", `${API}/posts/${encodeURIComponent(id)}`, {
          headers: await headers(),
        });
        if (r.lifecycleState === "PUBLISHED") return { state: "live", url: postUrl(id) };
        return { state: "processing", url: null, detail: r.lifecycleState };
      } catch (err) {
        if (err instanceof SocialError && (err.status === 404 || err.status === 410)) return { state: "gone", url: null };
        throw err;
      }
    },

    async remove(id: string): Promise<void> {
      try {
        await requestJson(http, "linkedin", `${API}/posts/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: await headers(),
        });
      } catch (err) {
        if (err instanceof SocialError && (err.status === 404 || err.status === 410)) return;
        throw err;
      }
    },
  };
}

/* Vendored from Kelin-Studio/kelin-social@9cf1e11 (src/tiktok.ts). Edit there and re-sync. */
/* TikTok, through the Content Posting API (Direct Post).

   Until TikTok audits the app, everything it posts is private (SELF_ONLY)
   and the account must be private too. After the audit, privacy comes from
   KELIN_TIKTOK_PRIVACY and must be one the creator's account offers.

   Media is pulled by TikTok from our URL, so the URL prefix (domain) must be
   verified in the TikTok app. A picture becomes a photo post, a video a video
   post. TikTok's API cannot delete a post: removal is by hand in the app.

   Access tokens last 24 hours, refresh tokens 365 days; TikTok may return a
   new refresh token on refresh, which this adapter keeps for the process. */
import { defaultHttp, form, requestJson, sleep, type Http } from "./http";
import { SocialError, type Adapter, type PostInput, type PostStatus, type Published } from "./types";

const API = "https://open.tiktokapis.com/v2";
export const TIKTOK_TITLE_LIMIT = 90;
export const TIKTOK_DESCRIPTION_LIMIT = 4000;

export type TikTokConfig = {
  clientKey: string;
  clientSecret: string;
  refreshToken: string;
  /** PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, FOLLOWER_OF_CREATOR or SELF_ONLY. */
  privacy?: string;
};

type Envelope<T> = { data?: T; error?: { code?: string; message?: string } };

export function tiktokAccount(cfg: TikTokConfig, http: Http = defaultHttp): Adapter {
  let token = "";
  let refresh = cfg.refreshToken;

  async function auth(): Promise<Record<string, string>> {
    if (!token) {
      const r = await requestJson<{ access_token?: string; refresh_token?: string; error_description?: string }>(
        http, "tiktok", `${API}/oauth/token/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form({ client_key: cfg.clientKey, client_secret: cfg.clientSecret, grant_type: "refresh_token", refresh_token: refresh }),
        },
      );
      if (!r.access_token) throw new SocialError("tiktok", `token refresh failed: ${r.error_description ?? "no token"}`);
      token = r.access_token;
      if (r.refresh_token) refresh = r.refresh_token;
    }
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" };
  }

  async function call<T>(path: string, body: unknown): Promise<T> {
    const r = await requestJson<Envelope<T>>(http, "tiktok", `${API}${path}`, { method: "POST", headers: await auth(), body: JSON.stringify(body) });
    if (r.error?.code && r.error.code !== "ok") throw new SocialError("tiktok", r.error.message || r.error.code, 400, false, r.error.code);
    return r.data as T;
  }

  return {
    network: "tiktok",

    async publish(input: PostInput): Promise<Published> {
      const privacy = cfg.privacy || "PUBLIC_TO_EVERYONE";
      const text = input.link && !input.text.includes(input.link) ? `${input.text}\n\n${input.link}` : input.text;
      let publishId: string | undefined;
      if (input.videoUrl) {
        const d = await call<{ publish_id?: string }>("/post/publish/video/init/", {
          post_info: { title: text.slice(0, 2200), privacy_level: privacy, disable_comment: false, disable_duet: false, disable_stitch: false, is_aigc: input.aiGenerated === true },
          source_info: { source: "PULL_FROM_URL", video_url: input.videoUrl },
        });
        publishId = d?.publish_id;
      } else if (input.imageUrl) {
        const d = await call<{ publish_id?: string }>("/post/publish/content/init/", {
          post_info: {
            title: (input.title || text.split("\n")[0]).slice(0, TIKTOK_TITLE_LIMIT),
            description: text.slice(0, TIKTOK_DESCRIPTION_LIMIT),
            privacy_level: privacy, disable_comment: false, auto_add_music: true,
          },
          source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: [input.imageUrl] },
          post_mode: "DIRECT_POST",
          media_type: "PHOTO",
        });
        publishId = d?.publish_id;
      } else {
        throw new SocialError("tiktok", "a TikTok post needs a picture or a video");
      }
      if (!publishId) throw new SocialError("tiktok", "TikTok returned no publish id");
      /* TikTok fetches and processes the media; give it a little while. */
      for (let i = 0; i < 20; i++) {
        const s = await this.status(publishId);
        if (s.state === "live") return { id: publishId, url: s.url };
        if (s.state === "failed") throw new SocialError("tiktok", `TikTok could not publish: ${s.detail ?? "failed"}`);
        await sleep(http.pollMs * 2);
      }
      return { id: publishId, url: null };
    },

    async status(id: string): Promise<PostStatus> {
      const d = await call<{ status?: string; fail_reason?: string; publicaly_available_post_id?: Array<string | number> }>(
        "/post/publish/status/fetch/", { publish_id: id },
      );
      if (d?.status === "PUBLISH_COMPLETE") {
        const postId = d.publicaly_available_post_id?.[0];
        return { state: "live", url: postId ? `https://www.tiktok.com/video/${postId}` : null };
      }
      if (d?.status === "FAILED") return { state: "failed", url: null, detail: d.fail_reason };
      return { state: "processing", url: null, detail: d?.status };
    },

    async remove(): Promise<void> {
      throw new SocialError("tiktok", "TikTok's API cannot delete a post; remove it in the TikTok app", null, false, "no_delete");
    },
  };
}

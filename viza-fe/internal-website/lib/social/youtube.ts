/* Vendored from Kelin-Studio/kelin-social@9cf1e11 (src/youtube.ts). Edit there and re-sync. */
/* YouTube, through the Data API v3 (videos.insert, resumable upload).

   A vertical mp4 under three minutes is shown as a Short; there is no separate
   Shorts endpoint. The adapter downloads the video from its public URL and
   uploads it in one resumable session, so it needs a function that can hold
   the file in memory (shorts are 5 to 15 MB).

   Google keeps every video uploaded through an unverified API project private
   until the project passes YouTube's API compliance audit, whatever privacy is
   asked for. KELIN_YOUTUBE_PRIVACY (public, unlisted or private, default
   public) applies once the project is audited.

   Access tokens last an hour; the refresh token does not expire while the
   OAuth app is "In production" (in "Testing" it lasts 7 days). */
import { defaultHttp, form, requestJson, type Http } from "./http";
import { SocialError, type Adapter, type PostInput, type PostStatus, type Published } from "./types";

export const YOUTUBE_TITLE_LIMIT = 100;
export const YOUTUBE_DESCRIPTION_LIMIT = 5000;
const API = "https://www.googleapis.com/youtube/v3";
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos";

export type YouTubeConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** public, unlisted or private. Default public. */
  privacy?: string;
  /** YouTube category id. Default 19, Travel & Events. */
  categoryId?: string;
};

const shortUrl = (id: string) => `https://www.youtube.com/shorts/${id}`;

/** YouTube refuses titles with angle brackets and longer than 100 characters. */
export function youtubeTitle(value: string): string {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, YOUTUBE_TITLE_LIMIT);
}

export function youtubeChannel(cfg: YouTubeConfig, http: Http = defaultHttp): Adapter {
  let token = "";

  async function auth(): Promise<string> {
    if (token) return token;
    const r = await requestJson<{ access_token?: string }>(http, "youtube", "https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: cfg.refreshToken, grant_type: "refresh_token" }),
    });
    if (!r.access_token) throw new SocialError("youtube", "token refresh returned no access token");
    token = r.access_token;
    return token;
  }

  async function fail(res: Response, what: string): Promise<never> {
    let message = `${what} failed (${res.status})`;
    try {
      const body = await res.json() as { error?: { message?: string; errors?: Array<{ reason?: string }> } };
      if (body.error?.message) message = `${what}: ${body.error.message}`;
      throw new SocialError("youtube", message, res.status, res.status === 429 || res.status >= 500, body.error?.errors?.[0]?.reason ?? null);
    } catch (error) {
      if (error instanceof SocialError) throw error;
      throw new SocialError("youtube", message, res.status, res.status === 429 || res.status >= 500);
    }
  }

  return {
    network: "youtube",

    async publish(input: PostInput): Promise<Published> {
      if (!input.videoUrl) throw new SocialError("youtube", "a YouTube post needs a video");
      const text = input.link && !input.text.includes(input.link) ? `${input.text}\n\n${input.link}` : input.text;
      const title = youtubeTitle(input.title || text.split("\n")[0] || "");
      if (!title) throw new SocialError("youtube", "a YouTube video needs a title");

      const source = await http.fetch(input.videoUrl, { signal: AbortSignal.timeout(60_000) });
      if (!source.ok) throw new SocialError("youtube", `could not download the video (${source.status})`, source.status);
      const bytes = new Uint8Array(await source.arrayBuffer());

      const bearer = `Bearer ${await auth()}`;
      const metadata = {
        snippet: { title, description: text.slice(0, YOUTUBE_DESCRIPTION_LIMIT), categoryId: cfg.categoryId || "19" },
        status: {
          privacyStatus: cfg.privacy || "public",
          selfDeclaredMadeForKids: false,
          containsSyntheticMedia: input.aiGenerated === true,
        },
      };
      const session = await http.fetch(`${UPLOAD}?uploadType=resumable&part=snippet,status`, {
        method: "POST",
        headers: {
          Authorization: bearer,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "video/mp4",
          "X-Upload-Content-Length": String(bytes.byteLength),
        },
        body: JSON.stringify(metadata),
        signal: AbortSignal.timeout(30_000),
      });
      if (!session.ok) await fail(session, "starting the upload");
      const location = session.headers.get("location");
      if (!location) throw new SocialError("youtube", "YouTube returned no upload address");

      const uploaded = await http.fetch(location, {
        method: "PUT",
        headers: { Authorization: bearer, "Content-Type": "video/mp4" },
        body: bytes,
        signal: AbortSignal.timeout(240_000),
      });
      if (!uploaded.ok) await fail(uploaded, "uploading the video");
      const video = await uploaded.json() as { id?: string };
      if (!video.id) throw new SocialError("youtube", "YouTube returned no video id");
      return { id: video.id, url: shortUrl(video.id) };
    },

    async status(id: string): Promise<PostStatus> {
      const r = await requestJson<{ items?: Array<{ status?: { uploadStatus?: string; privacyStatus?: string; failureReason?: string; rejectionReason?: string } }> }>(
        http, "youtube", `${API}/videos?part=status&id=${encodeURIComponent(id)}`,
        { headers: { Authorization: `Bearer ${await auth()}` } },
      );
      const status = r.items?.[0]?.status;
      if (!status) return { state: "gone", url: null };
      if (status.uploadStatus === "failed" || status.uploadStatus === "rejected") {
        return { state: "failed", url: null, detail: status.failureReason ?? status.rejectionReason ?? status.uploadStatus };
      }
      if (status.uploadStatus === "processed") return { state: "live", url: shortUrl(id), detail: status.privacyStatus };
      return { state: "processing", url: shortUrl(id), detail: status.uploadStatus };
    },

    async remove(id: string): Promise<void> {
      const res = await http.fetch(`${API}/videos?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${await auth()}` },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok || res.status === 404) return;
      await fail(res, "deleting the video");
    },
  };
}

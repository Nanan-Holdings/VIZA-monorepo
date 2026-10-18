/* Vendored from Kelin-Studio/kelin-social@9cf1e11 (src/meta.ts). Edit there and re-sync. */
/* Facebook Page and Instagram, straight to Meta's Graph API.

   Both run on one Page access token. A Page token minted from a long-lived
   user token does not expire, so it can sit in an environment variable; it
   stops working only if the person who minted it loses the Page role or
   changes their password. Instagram goes through "Instagram API with Facebook
   Login": the professional account linked to the Page, the same token.

   Our own Page and account work under Standard Access because the token comes
   from a person with a role on the app. No App Review is involved. */
import { defaultHttp, form, requestJson, sleep, type Http } from "./http";
import { SocialError, type Adapter, type PostInput, type PostStatus, type Published } from "./types";

export const DEFAULT_GRAPH_VERSION = "v24.0";

export type MetaConfig = {
  pageId: string;
  pageToken: string;
  /** The Instagram professional account id linked to the Page (not the @handle). */
  instagramUserId?: string;
  graphVersion?: string;
};

/** Graph answers a read of a deleted object with code 100 subcode 33. */
function isGone(err: unknown): boolean {
  if (!(err instanceof SocialError)) return false;
  return err.status === 404 || err.code === "100/33" || /does not exist|cannot be loaded/i.test(err.message);
}

function base(cfg: MetaConfig): string {
  return `https://graph.facebook.com/${cfg.graphVersion ?? DEFAULT_GRAPH_VERSION}`;
}

export function facebookPage(cfg: MetaConfig, http: Http = defaultHttp): Adapter {
  const url = (path: string) => `${base(cfg)}/${path}`;

  async function permalink(id: string): Promise<string | null> {
    try {
      const r = await requestJson<{ permalink_url?: string }>(
        http, "facebook", `${url(id)}?fields=permalink_url&access_token=${encodeURIComponent(cfg.pageToken)}`,
      );
      return r.permalink_url ?? null;
    } catch {
      return null; // The post is up; an address is a nicety.
    }
  }

  return {
    network: "facebook",

    async publish(input: PostInput): Promise<Published> {
      /* A link post lets Facebook build the preview card from the page's own
         Open Graph image, which is the cover. A photo post is only for a
         picture with nowhere to send people. */
      let id: string;
      if (input.link || !input.imageUrl) {
        const r = await requestJson<{ id: string }>(http, "facebook", url(`${cfg.pageId}/feed`), {
          method: "POST",
          body: form({ message: input.text, link: input.link, access_token: cfg.pageToken }),
        });
        id = r.id;
      } else {
        const r = await requestJson<{ id: string; post_id?: string }>(http, "facebook", url(`${cfg.pageId}/photos`), {
          method: "POST",
          body: form({ url: input.imageUrl, message: input.text, access_token: cfg.pageToken }),
        });
        id = r.post_id ?? r.id;
      }
      if (!id) throw new SocialError("facebook", "Graph returned no post id");
      return { id, url: (await permalink(id)) ?? `https://www.facebook.com/${id}` };
    },

    async status(id: string): Promise<PostStatus> {
      try {
        const r = await requestJson<{ permalink_url?: string; is_published?: boolean }>(
          http, "facebook", `${url(id)}?fields=permalink_url,is_published&access_token=${encodeURIComponent(cfg.pageToken)}`,
        );
        return { state: r.is_published === false ? "processing" : "live", url: r.permalink_url ?? null };
      } catch (err) {
        if (isGone(err)) return { state: "gone", url: null };
        throw err;
      }
    },

    async remove(id: string): Promise<void> {
      try {
        await requestJson(http, "facebook", `${url(id)}?access_token=${encodeURIComponent(cfg.pageToken)}`, { method: "DELETE" });
      } catch (err) {
        if (isGone(err)) return; // Already down is the outcome we wanted.
        throw err;
      }
    },
  };
}

type Container = { status_code?: "FINISHED" | "IN_PROGRESS" | "ERROR" | "EXPIRED" | "PUBLISHED"; status?: string };

export function instagram(cfg: MetaConfig, http: Http = defaultHttp): Adapter {
  const igId = cfg.instagramUserId;
  const url = (path: string) => `${base(cfg)}/${path}`;
  const token = `access_token=${encodeURIComponent(cfg.pageToken)}`;

  function need(): string {
    if (!igId) throw new SocialError("instagram", "no Instagram account id is configured");
    return igId;
  }

  return {
    network: "instagram",

    async publish(input: PostInput): Promise<Published> {
      const account = need();
      if (!input.imageUrl && !input.videoUrl) {
        throw new SocialError("instagram", "an image or a video is required");
      }
      /* Two steps: a container Meta fetches the media into, then the publish.
         Images are usually ready at once; Reels take a while to transcode. */
      const created = await requestJson<{ id: string }>(http, "instagram", url(`${account}/media`), {
        method: "POST",
        body: form(
          input.videoUrl
            ? { media_type: "REELS", video_url: input.videoUrl, caption: input.text, access_token: cfg.pageToken }
            : { image_url: input.imageUrl, caption: input.text, access_token: cfg.pageToken },
        ),
      });
      const attempts = input.videoUrl ? 90 : 20;
      for (let i = 0; ; i++) {
        const c = await requestJson<Container>(http, "instagram", `${url(created.id)}?fields=status_code,status&${token}`);
        if (c.status_code === "FINISHED") break;
        if (c.status_code === "ERROR" || c.status_code === "EXPIRED") {
          throw new SocialError("instagram", `Meta could not take the media: ${c.status ?? c.status_code}`);
        }
        if (i >= attempts) throw new SocialError("instagram", "the media was still processing, nothing was posted", null, true);
        await sleep(http.pollMs);
      }
      const published = await requestJson<{ id: string }>(http, "instagram", url(`${account}/media_publish`), {
        method: "POST",
        body: form({ creation_id: created.id, access_token: cfg.pageToken }),
      });
      let link: string | null = null;
      try {
        const r = await requestJson<{ permalink?: string }>(http, "instagram", `${url(published.id)}?fields=permalink&${token}`);
        link = r.permalink ?? null;
      } catch {
        /* Up, address unknown. */
      }
      return { id: published.id, url: link };
    },

    async status(id: string): Promise<PostStatus> {
      try {
        const r = await requestJson<{ permalink?: string }>(http, "instagram", `${url(id)}?fields=permalink&${token}`);
        return { state: "live", url: r.permalink ?? null };
      } catch (err) {
        if (isGone(err)) return { state: "gone", url: null };
        throw err;
      }
    },

    /* The IG Media Deleting API (Dec 2025) works only through Facebook Login,
       which is the path this adapter is on. */
    async remove(id: string): Promise<void> {
      try {
        await requestJson(http, "instagram", `${url(id)}?${token}`, { method: "DELETE" });
      } catch (err) {
        if (isGone(err)) return;
        throw err;
      }
    },
  };
}

/* Vendored from Kelin-Studio/kelin-social@9cf1e11 (src/threads.ts). Edit there and re-sync. */
/* Threads, through the Threads API (graph.threads.net), not the Facebook Graph.

   Threads tokens are their own: a long-lived one lasts 60 days and must be
   refreshed before it lapses (`refreshThreadsToken`). The account posting has
   to be a Threads tester on the app, which is what lets it run without review. */
import { defaultHttp, form, requestJson, sleep, type Http } from "./http";
import { SocialError, type Adapter, type PostInput, type PostStatus, type Published } from "./types";

const BASE = "https://graph.threads.net/v1.0";
export const THREADS_TEXT_LIMIT = 500;

export type ThreadsConfig = { userId: string; token: string };

type Container = { status?: "FINISHED" | "IN_PROGRESS" | "ERROR" | "EXPIRED" | "PUBLISHED"; error_message?: string };

function isGone(err: unknown): boolean {
  return err instanceof SocialError && (err.status === 404 || /does not exist|cannot be loaded/i.test(err.message));
}

export function threads(cfg: ThreadsConfig, http: Http = defaultHttp): Adapter {
  const token = `access_token=${encodeURIComponent(cfg.token)}`;

  return {
    network: "threads",

    async publish(input: PostInput): Promise<Published> {
      if (input.text.length > THREADS_TEXT_LIMIT) {
        throw new SocialError("threads", `the text is ${input.text.length} characters, Threads takes ${THREADS_TEXT_LIMIT}`);
      }
      /* A link card is only allowed on a text post, so a post with a picture
         carries its link in the text instead. */
      const params = input.imageUrl
        ? { media_type: "IMAGE", image_url: input.imageUrl, text: input.text }
        : { media_type: "TEXT", text: input.text, link_attachment: input.link };
      const created = await requestJson<{ id: string }>(http, "threads", `${BASE}/${cfg.userId}/threads`, {
        method: "POST",
        body: form({ ...params, access_token: cfg.token }),
      });
      for (let i = 0; ; i++) {
        const c = await requestJson<Container>(http, "threads", `${BASE}/${created.id}?fields=status,error_message&${token}`);
        if (c.status === "FINISHED") break;
        if (c.status === "ERROR" || c.status === "EXPIRED") {
          throw new SocialError("threads", `Threads could not take the post: ${c.error_message ?? c.status}`);
        }
        if (i >= 30) throw new SocialError("threads", "the post was still processing, nothing was published", null, true);
        await sleep(http.pollMs);
      }
      const published = await requestJson<{ id: string }>(http, "threads", `${BASE}/${cfg.userId}/threads_publish`, {
        method: "POST",
        body: form({ creation_id: created.id, access_token: cfg.token }),
      });
      let url: string | null = null;
      try {
        const r = await requestJson<{ permalink?: string }>(http, "threads", `${BASE}/${published.id}?fields=permalink&${token}`);
        url = r.permalink ?? null;
      } catch {
        /* Up, address unknown. */
      }
      return { id: published.id, url };
    },

    async status(id: string): Promise<PostStatus> {
      try {
        const r = await requestJson<{ permalink?: string }>(http, "threads", `${BASE}/${id}?fields=permalink&${token}`);
        return { state: "live", url: r.permalink ?? null };
      } catch (err) {
        if (isGone(err)) return { state: "gone", url: null };
        throw err;
      }
    },

    /** Needs the `threads_delete` permission. Threads allows 100 deletes a day. */
    async remove(id: string): Promise<void> {
      try {
        await requestJson(http, "threads", `${BASE}/${id}?${token}`, { method: "DELETE" });
      } catch (err) {
        if (isGone(err)) return;
        throw err;
      }
    },
  };
}

/** Swaps a long-lived Threads token (at least a day old, not yet expired) for
    a fresh 60-day one. Store what comes back; the old token keeps working
    until its own expiry. */
export async function refreshThreadsToken(
  token: string,
  http: Http = defaultHttp,
): Promise<{ token: string; expiresAt: Date }> {
  const r = await requestJson<{ access_token: string; expires_in: number }>(
    http, "threads",
    `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(token)}`,
  );
  return { token: r.access_token, expiresAt: new Date(Date.now() + r.expires_in * 1000) };
}

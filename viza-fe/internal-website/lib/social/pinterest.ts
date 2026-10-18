/* Vendored from Kelin-Studio/kelin-social@9cf1e11 (src/pinterest.ts). Edit there and re-sync. */
/* Pinterest, through API v5.

   An app on Trial access can create pins, but Pinterest shows them only to
   the account that made them; Standard access (a reviewed demo video) makes
   them public. Trial apps may be told to write to api-sandbox.pinterest.com,
   so the host is configurable.

   Access tokens last 30 days, refresh tokens 365. The adapter swaps the
   refresh token for an access token on first use, so only the refresh token
   needs replacing, once a year. */
import { defaultHttp, form, requestJson, type Http } from "./http";
import { SocialError, type Adapter, type PostInput, type PostStatus, type Published } from "./types";

export const PINTEREST_TITLE_LIMIT = 100;
export const PINTEREST_DESCRIPTION_LIMIT = 800;

export type PinterestConfig = {
  boardId: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  /** Default https://api.pinterest.com */
  apiHost?: string;
};

const pinUrl = (id: string) => `https://www.pinterest.com/pin/${id}/`;

export function pinterestBoard(cfg: PinterestConfig, http: Http = defaultHttp): Adapter {
  const api = `${(cfg.apiHost || "https://api.pinterest.com").replace(/\/$/, "")}/v5`;
  let token = "";

  async function accessToken(): Promise<string> {
    if (token) return token;
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
    const r = await requestJson<{ access_token: string }>(http, "pinterest", `${api}/oauth/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ grant_type: "refresh_token", refresh_token: cfg.refreshToken }),
    });
    token = r.access_token;
    return token;
  }

  const auth = async () => ({ Authorization: `Bearer ${await accessToken()}` });
  const isGone = (err: unknown) => err instanceof SocialError && err.status === 404;

  return {
    network: "pinterest",

    async publish(input: PostInput): Promise<Published> {
      if (!input.imageUrl) throw new SocialError("pinterest", "a pin needs an image");
      const title = (input.title || input.text.split("\n")[0]).slice(0, PINTEREST_TITLE_LIMIT);
      const r = await requestJson<{ id?: string }>(http, "pinterest", `${api}/pins`, {
        method: "POST",
        headers: { ...(await auth()), "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id: cfg.boardId,
          title,
          description: input.text.slice(0, PINTEREST_DESCRIPTION_LIMIT),
          ...(input.link ? { link: input.link } : {}),
          media_source: { source_type: "image_url", url: input.imageUrl },
        }),
      });
      if (!r.id) throw new SocialError("pinterest", "Pinterest returned no pin id");
      return { id: r.id, url: pinUrl(r.id) };
    },

    async status(id: string): Promise<PostStatus> {
      try {
        await requestJson(http, "pinterest", `${api}/pins/${encodeURIComponent(id)}`, { headers: await auth() });
        return { state: "live", url: pinUrl(id) };
      } catch (err) {
        if (isGone(err)) return { state: "gone", url: null };
        throw err;
      }
    },

    async remove(id: string): Promise<void> {
      try {
        await requestJson(http, "pinterest", `${api}/pins/${encodeURIComponent(id)}`, { method: "DELETE", headers: await auth() });
      } catch (err) {
        if (isGone(err)) return;
        throw err;
      }
    },
  };
}

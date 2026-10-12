/** Refuse to distribute a VIZA link before the public site serves it. */
export async function assertLiveMarketingUrl(value: string): Promise<void> {
  const configured = process.env.VIZA_MARKETING_PUBLIC_BASE_URL?.trim();
  if (!configured) throw new Error("VIZA_MARKETING_PUBLIC_BASE_URL is not configured");
  const base = new URL(configured);
  const target = new URL(value);
  if (target.protocol !== "https:" && target.hostname !== "localhost" && target.hostname !== "127.0.0.1") throw new Error("Social destination must use HTTPS");
  if (target.origin !== base.origin) return;
  const response = await fetch(target, { method: "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
  await response.body?.cancel();
  if (response.status !== 200) throw new Error(`Public destination is not live (${response.status})`);
}

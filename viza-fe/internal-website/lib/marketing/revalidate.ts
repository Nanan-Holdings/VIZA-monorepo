import type { MarketingBlogLocale } from "./contracts";

export async function revalidatePublicMarketingBlog(input: { locale: MarketingBlogLocale; slug: string }) {
  const base = process.env.VIZA_MARKETING_PUBLIC_BASE_URL?.trim();
  const secret = process.env.VIZA_MARKETING_REVALIDATE_SECRET?.trim();
  if (!base || !secret) throw new Error("Marketing cache revalidation is not configured");
  const endpoint = new URL("/api/revalidate", base);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Marketing cache revalidation failed (${response.status})`);
}

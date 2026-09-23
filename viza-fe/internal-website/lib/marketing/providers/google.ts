import { importPKCS8, SignJWT } from "jose";
import type { MarketingAnalyticsOverview } from "../contracts";
import { MarketingProviderConfigError } from "./openrouter";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

async function accessToken(scopes: string[]): Promise<string> {
  const clientEmail = process.env.VIZA_MARKETING_GOOGLE_CLIENT_EMAIL?.trim();
  const privateKeyText = process.env.VIZA_MARKETING_GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!clientEmail) throw new MarketingProviderConfigError("VIZA_MARKETING_GOOGLE_CLIENT_EMAIL is not configured");
  if (!privateKeyText) throw new MarketingProviderConfigError("VIZA_MARKETING_GOOGLE_PRIVATE_KEY is not configured");
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(privateKeyText, "RS256");
  const assertion = await new SignJWT({ scope: scopes.join(" ") })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(clientEmail).setSubject(clientEmail)
    .setAudience(GOOGLE_TOKEN_URL).setIssuedAt(now).setExpirationTime(now + 3600).sign(key);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Google authentication failed (${response.status})`);
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error("Google authentication returned no access token");
  return data.access_token;
}

function metric(row: { metricValues?: Array<{ value?: string }> } | undefined, index: number): number | null {
  const value = Number(row?.metricValues?.[index]?.value);
  return Number.isFinite(value) ? value : null;
}

export function googleReadiness() {
  const identity = Boolean(process.env.VIZA_MARKETING_GOOGLE_CLIENT_EMAIL?.trim() && process.env.VIZA_MARKETING_GOOGLE_PRIVATE_KEY?.trim());
  return { ga4: identity && Boolean(process.env.VIZA_MARKETING_GA4_PROPERTY_ID?.trim()), searchConsole: identity && Boolean(process.env.VIZA_MARKETING_GSC_SITE_URL?.trim()) };
}

export async function fetchAnalyticsOverview(windowDays: number): Promise<MarketingAnalyticsOverview> {
  const days = Math.min(365, Math.max(1, Math.floor(windowDays)));
  const readiness = googleReadiness();
  const overview: MarketingAnalyticsOverview = {
    connected: { ga4: readiness.ga4, searchConsole: readiness.searchConsole }, windowDays: days,
    totalUsers: null, sessions: null, pageViews: null, conversions: null, searchClicks: null, searchImpressions: null,
    dailyUsers: [], topCountries: [],
  };
  if (!readiness.ga4 && !readiness.searchConsole) return overview;
  const token = await accessToken(["https://www.googleapis.com/auth/analytics.readonly", "https://www.googleapis.com/auth/webmasters.readonly"]);
  const startDate = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);
  if (readiness.ga4) {
    const propertyId = process.env.VIZA_MARKETING_GA4_PROPERTY_ID!.trim();
    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ dateRanges: [{ startDate, endDate }], dimensions: [{ name: "date" }, { name: "country" }], metrics: [{ name: "totalUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "keyEvents" }], metricAggregations: ["TOTAL"], limit: 10000 }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Google Analytics request failed (${response.status})`);
    const data = await response.json() as { rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>; totals?: Array<{ metricValues?: Array<{ value?: string }> }> };
    overview.totalUsers = metric(data.totals?.[0], 0); overview.sessions = metric(data.totals?.[0], 1);
    overview.pageViews = metric(data.totals?.[0], 2); overview.conversions = metric(data.totals?.[0], 3);
    const daily = new Map<string, number>(); const countries = new Map<string, number>();
    for (const row of data.rows ?? []) {
      const rawDate = row.dimensionValues?.[0]?.value ?? "";
      const date = /^\d{8}$/.test(rawDate) ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6)}` : rawDate;
      const country = row.dimensionValues?.[1]?.value ?? "Unknown"; const users = metric(row, 0) ?? 0;
      daily.set(date, (daily.get(date) ?? 0) + users); countries.set(country, (countries.get(country) ?? 0) + users);
    }
    overview.dailyUsers = [...daily].map(([date, users]) => ({ date, users })).sort((a, b) => a.date.localeCompare(b.date));
    overview.topCountries = [...countries].map(([country, users]) => ({ country, users })).sort((a, b) => b.users - a.users).slice(0, 10);
  }
  if (readiness.searchConsole) {
    const siteUrl = process.env.VIZA_MARKETING_GSC_SITE_URL!.trim();
    const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, rowLimit: 1 }), signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Search Console request failed (${response.status})`);
    const data = await response.json() as { rows?: Array<{ clicks?: number; impressions?: number }> };
    overview.searchClicks = data.rows?.reduce((sum, row) => sum + (row.clicks ?? 0), 0) ?? 0;
    overview.searchImpressions = data.rows?.reduce((sum, row) => sum + (row.impressions ?? 0), 0) ?? 0;
  }
  return overview;
}

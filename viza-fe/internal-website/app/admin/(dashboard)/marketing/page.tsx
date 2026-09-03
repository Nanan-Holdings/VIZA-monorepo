import Link from "next/link";
import { ChartLineUp, CursorClick, Eye, FileText, MagnifyingGlass, Megaphone, Users } from "@phosphor-icons/react/ssr";
import { getLocale } from "next-intl/server";
import { getMarketingOperationsDashboard } from "@/app/actions/admin-marketing";
import { AdminMetricCard, AdminPage, AdminPageHeader, AdminSectionCard } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { ConnectionBadge, RecentBlogCard, RecentSocialCard } from "./_components/marketing-ui";
import { marketingStatusLabel, MARKETING_COPY } from "./copy";

export const dynamic = "force-dynamic";

export default async function MarketingDashboardPage() {
  const locale = normalizeInterfaceLocale(await getLocale()); const copy = MARKETING_COPY[locale];
  const dashboard = await getMarketingOperationsDashboard(); const { analytics, providers, socialAnalytics } = dashboard;
  const metric = (value: number | null) => value === null ? "—" : new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-SG").format(value);
  return <AdminPage><AdminPageHeader title={copy.dashboardTitle} description={copy.dashboardDescription} actions={<><Button asChild variant="outline"><Link href="/admin/marketing/tracking">{copy.trackingTitle}</Link></Button><Button asChild variant="outline"><Link href="/admin/marketing/blog">{copy.blogTitle}</Link></Button><Button asChild><Link href="/admin/marketing/social">{copy.socialTitle}</Link></Button></>} />
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AdminMetricCard label={copy.users} value={metric(analytics.totalUsers)} icon={Users} helper={`${analytics.windowDays} ${copy.days}`} /><AdminMetricCard label={copy.sessions} value={metric(analytics.sessions)} icon={ChartLineUp} /><AdminMetricCard label={copy.views} value={metric(analytics.pageViews)} icon={Eye} /><AdminMetricCard label={copy.conversions} value={metric(analytics.conversions)} icon={Megaphone} /></section>
    <AdminSectionCard title={copy.providers} description={copy.providerDescription}><CardContent className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4"><Provider label="OpenRouter" detail={providers.openrouter.model ?? undefined} connected={providers.openrouter.connected} copy={copy} /><Provider label="Zernio" detail={providers.zernio.connected ? `${providers.zernio.configuredPlatforms.length} ${copy.platformsUnit}` : undefined} connected={providers.zernio.connected} copy={copy} /><Provider label="Google Analytics 4" connected={providers.ga4.connected} copy={copy} /><Provider label="Search Console" connected={providers.searchConsole.connected} copy={copy} /></CardContent></AdminSectionCard>
    <section className="grid gap-4 sm:grid-cols-2"><AdminMetricCard label={copy.searchClicks} value={metric(analytics.searchClicks)} icon={MagnifyingGlass} tone={providers.searchConsole.connected ? "default" : "warning"} /><AdminMetricCard label={copy.searchImpressions} value={metric(analytics.searchImpressions)} icon={FileText} tone={providers.searchConsole.connected ? "default" : "warning"} /></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AdminMetricCard label={copy.socialPosts} value={metric(socialAnalytics.postCount)} icon={Megaphone} tone={socialAnalytics.connected ? "default" : "warning"} /><AdminMetricCard label={copy.socialImpressions} value={metric(socialAnalytics.impressions)} icon={Eye} tone={socialAnalytics.connected ? "default" : "warning"} /><AdminMetricCard label={copy.socialClicks} value={metric(socialAnalytics.clicks)} icon={CursorClick} tone={socialAnalytics.connected ? "default" : "warning"} /><AdminMetricCard label={copy.engagementRate} value={socialAnalytics.connected ? `${socialAnalytics.engagementRate.toFixed(2)}%` : "—"} icon={ChartLineUp} tone={socialAnalytics.connected ? "default" : "warning"} /></section>
    <section className="grid gap-6 xl:grid-cols-2"><AnalyticsBars title={copy.trafficTrend} rows={analytics.dailyUsers.slice(-14).map((row) => ({ label: row.date.slice(5), value: row.users }))} empty={copy.noAnalyticsRows} metric={metric} /><AnalyticsBars title={copy.topCountries} rows={analytics.topCountries.slice(0, 8).map((row) => ({ label: row.country || "—", value: row.users }))} empty={copy.noAnalyticsRows} metric={metric} /></section>
    <div className="grid gap-6 xl:grid-cols-2"><RecentBlogCard posts={dashboard.recentPosts} copy={copy} /><RecentSocialCard rows={dashboard.recentSocial} copy={copy} /></div>
    <AdminSectionCard title={copy.automationRuns} description={copy.automationDescription}><CardContent className="divide-y p-0">{dashboard.recentAutomation.length ? dashboard.recentAutomation.map((run) => <div key={run.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{run.jobType.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{run.errorMessage ?? run.idempotencyKey}</p></div><div className="text-xs text-muted-foreground">{marketingStatusLabel(copy, run.status)} · {new Date(run.startedAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-SG")}</div></div>) : <p className="p-5 text-sm text-muted-foreground">{copy.noAutomationRuns}</p>}</CardContent></AdminSectionCard>
  </AdminPage>;
}

function Provider({ label, detail, connected, copy }: { label: string; detail?: string; connected: boolean; copy: (typeof MARKETING_COPY)["en"] | (typeof MARKETING_COPY)["zh"] }) { return <div className="rounded-lg border bg-muted/10 p-4"><div className="flex items-center justify-between gap-2"><p className="font-medium">{label}</p><ConnectionBadge connected={connected} copy={copy} /></div>{detail ? <p className="mt-2 truncate text-xs text-muted-foreground">{detail}</p> : null}</div>; }

function AnalyticsBars({ title, rows, empty, metric }: { title: string; rows: Array<{ label: string; value: number }>; empty: string; metric: (value: number | null) => string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <AdminSectionCard title={title}><CardContent className="space-y-3 p-5">{rows.length ? rows.map((row) => <div key={row.label} className="grid grid-cols-[minmax(72px,120px)_1fr_auto] items-center gap-3 text-xs"><span className="truncate text-muted-foreground">{row.label}</span><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} /></div><span className="tabular-nums">{metric(row.value)}</span></div>) : <p className="text-sm text-muted-foreground">{empty}</p>}</CardContent></AdminSectionCard>;
}

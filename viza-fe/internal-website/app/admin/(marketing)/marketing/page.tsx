import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getMarketingOperationsDashboard } from "@/app/actions/admin-marketing";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { requireRole } from "@/lib/rbac";
import { BlogList, SocialList, statusTone } from "./_components/marketing-ui";
import {
  BarRows,
  Counter,
  Counters,
  PortalHeader,
  PortalPage,
  PortalSection,
  PortalStack,
  StatusBadge,
} from "./_components/portal-ui";
import { MARKETING_COPY, marketingDateLocale, marketingStatusLabel } from "./copy";

export const dynamic = "force-dynamic";

export default async function MarketingDashboardPage() {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = MARKETING_COPY[locale];
  const dateLocale = marketingDateLocale(copy);
  /* requireRole throws for anyone who should not be here; the layout has
     already redirected, this is the server-side belt. */
  const [dashboard] = await Promise.all([getMarketingOperationsDashboard(), requireRole("admin", "staff")]);
  const { analytics, providers, socialAnalytics } = dashboard;
  const format = new Intl.NumberFormat(dateLocale);
  const metric = (value: number | null) => (value === null ? "—" : format.format(value));

  return (
    <PortalPage>
      <PortalHeader
        title={copy.dashboardTitle}
        desc={copy.dashboardDescription}
        actions={
          <>
            <Link className="mkt-btn mkt-btn--secondary" href="/admin/marketing/tracking">
              {copy.trackingTitle}
            </Link>
            <Link className="mkt-btn mkt-btn--secondary" href="/admin/marketing/social">
              {copy.socialTitle}
            </Link>
            <Link className="mkt-btn mkt-btn--primary" href="/admin/marketing/blog">
              {copy.blogTitle}
            </Link>
          </>
        }
      />

      <PortalStack>
        <Counters>
          <Counter label={copy.users} value={metric(analytics.totalUsers)} helper={`${analytics.windowDays} ${copy.days}`} stale={!providers.ga4.connected} />
          <Counter label={copy.sessions} value={metric(analytics.sessions)} stale={!providers.ga4.connected} />
          <Counter label={copy.views} value={metric(analytics.pageViews)} stale={!providers.ga4.connected} />
          <Counter label={copy.conversions} value={metric(analytics.conversions)} stale={!providers.ga4.connected} />
        </Counters>

        <Counters>
          <Counter label={copy.searchClicks} value={metric(analytics.searchClicks)} stale={!providers.searchConsole.connected} />
          <Counter label={copy.searchImpressions} value={metric(analytics.searchImpressions)} stale={!providers.searchConsole.connected} />
          <Counter label={copy.socialImpressions} value={metric(socialAnalytics.connected ? socialAnalytics.impressions : null)} stale={!socialAnalytics.connected} />
          <Counter
            label={copy.engagementRate}
            value={socialAnalytics.connected ? `${socialAnalytics.engagementRate.toFixed(2)}%` : "—"}
            helper={socialAnalytics.connected ? `${format.format(socialAnalytics.postCount)} · ${format.format(socialAnalytics.clicks)} ${copy.clicks}` : undefined}
            stale={!socialAnalytics.connected}
          />
        </Counters>

        <PortalSection title={copy.providers} aside={copy.providerDescription}>
          <div className="mkt-tiles">
            <Tile label="Content AI" detail={providers.openrouter.model} connected={providers.openrouter.connected} copy={copy} />
            <Tile
              label={locale === "zh" ? "社媒投放" : "Social delivery"}
              detail={providers.zernio.connected ? `${providers.zernio.configuredPlatforms.length} ${copy.platformsUnit}` : null}
              connected={providers.zernio.connected}
              copy={copy}
            />
            <Tile label="Google Analytics 4" detail={null} connected={providers.ga4.connected} copy={copy} />
            <Tile label="Search Console" detail={null} connected={providers.searchConsole.connected} copy={copy} />
          </div>
        </PortalSection>

        <PortalSection title={copy.trafficTrend}>
          <div className="mkt-panel">
            <BarRows
              rows={analytics.dailyUsers.slice(-14).map((row) => ({ label: row.date.slice(5), value: row.users }))}
              empty={copy.noAnalyticsRows}
              format={(value) => format.format(value)}
            />
          </div>
        </PortalSection>

        <PortalSection title={copy.topCountries}>
          <div className="mkt-panel">
            <BarRows
              rows={analytics.topCountries.slice(0, 8).map((row) => ({ label: row.country || "—", value: row.users }))}
              empty={copy.noAnalyticsRows}
              format={(value) => format.format(value)}
            />
          </div>
        </PortalSection>

        <PortalSection title={copy.recentBlog} aside={copy.blogDescription}>
          <BlogList posts={dashboard.recentPosts} copy={copy} compact />
        </PortalSection>

        <PortalSection title={copy.recentSocial} aside={copy.socialDescription}>
          <SocialList rows={dashboard.recentSocial} copy={copy} compact />
        </PortalSection>

        <PortalSection title={copy.automationRuns} aside={copy.automationDescription}>
          {dashboard.recentAutomation.length ? (
            <div className="mkt-runs">
              {dashboard.recentAutomation.map((run) => (
                <div key={run.id} className="mkt-run">
                  <span className="mkt-run-when">
                    {new Date(run.startedAt).toLocaleString(dateLocale, {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="mkt-run-what">
                    {run.jobType.replaceAll("_", " ")} ·{" "}
                    <span className={`mkt-run-outcome is-${statusTone(run.status)}`}>
                      {marketingStatusLabel(copy, run.status)}
                    </span>
                  </span>
                  <span className="mkt-run-detail">{run.errorMessage ?? run.idempotencyKey}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mkt-note">{copy.noAutomationRuns}</p>
          )}
        </PortalSection>
      </PortalStack>
    </PortalPage>
  );
}

function Tile({
  label,
  detail,
  connected,
  copy,
}: {
  label: string;
  detail: string | null;
  connected: boolean;
  copy: (typeof MARKETING_COPY)["en"] | (typeof MARKETING_COPY)["zh"];
}) {
  return (
    <div className="mkt-tile">
      <div className="mkt-tile-head">
        <span>{label}</span>
        <StatusBadge dot label={connected ? copy.connected : copy.notConnected} tone={connected ? "up" : "warn"} />
      </div>
      {detail ? <div className="mkt-sub mkt-sub-mono">{detail}</div> : null}
    </div>
  );
}

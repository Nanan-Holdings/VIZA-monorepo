import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getMarketingOperationsDashboard, listMarketingBlogPosts } from "@/app/actions/admin-marketing";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { requireRole } from "@/lib/rbac";
import { BlogList, MarketingBackLink, statusTone } from "../_components/marketing-ui";
import { PortalHeader, PortalPage, PortalSection, PortalStack, StatusBadge } from "../_components/portal-ui";
import { MARKETING_COPY, marketingDateLocale, marketingStatusLabel } from "../copy";
import { RunNewsButton } from "../_components/run-news";

export const dynamic = "force-dynamic";

export default async function MarketingBlogPage() {
  const [localeValue, actor, posts, dashboard] = await Promise.all([
    getLocale(),
    requireRole("admin", "staff"),
    listMarketingBlogPosts(),
    getMarketingOperationsDashboard(),
  ]);
  const locale = normalizeInterfaceLocale(localeValue);
  const copy = MARKETING_COPY[locale];
  const dateLocale = marketingDateLocale(copy);
  const zh = locale === "zh";

  /* The same honest line the Volumet portal carries: what is missing on this
     deployment, named, rather than a feature that silently does nothing. */
  const missing = [
    dashboard.providers.openrouter.connected ? "" : zh ? "内容 AI（起草）" : "Content AI (drafting)",
    dashboard.providers.zernio.connected ? "" : zh ? "社媒投放" : "Social delivery",
    dashboard.providers.ga4.connected ? "" : "Google Analytics 4",
    dashboard.providers.searchConsole.connected ? "" : "Search Console",
  ].filter(Boolean);

  /* Only the runs that belong to the article pipeline. The social watchdog has
     its own screen and would just be noise here. */
  const runs = dashboard.recentAutomation.filter((run) => !run.jobType.includes("social")).slice(0, 5);

  return (
    <PortalPage>
      <MarketingBackLink href="/admin/marketing" label={copy.back} />
      <PortalHeader
        title={copy.blogTitle}
        desc={copy.blogPortalDescription}
        actions={
          <>
            {actor.role === "admin" ? (
              <RunNewsButton locale={locale} connected={dashboard.providers.openrouter.connected} />
            ) : null}
            <Link className="mkt-btn mkt-btn--primary" href="/admin/marketing/blog/new">
              {copy.newPost}
            </Link>
          </>
        }
      />

      <PortalStack>
        {missing.length ? (
          <p className="mkt-note mkt-note-rule">
            {copy.notConfigured}: {missing.join(", ")}.
          </p>
        ) : null}

        <BlogList posts={posts} copy={copy} />

        <PortalSection title={copy.automationRuns} aside={copy.automationDescription}>
          {runs.length ? (
            <div className="mkt-runs">
              {runs.map((run) => (
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
                  <span className="mkt-run-detail">
                    {run.errorMessage ?? run.idempotencyKey}
                    {run.outputEntityId ? (
                      <>
                        {" · "}
                        <Link href={`/admin/marketing/blog/${run.outputEntityId}`}>{copy.edit}</Link>
                      </>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mkt-note">{copy.noAutomationRuns}</p>
          )}
        </PortalSection>

        <PortalSection title={copy.providers} aside={copy.providerDescription}>
          <div className="mkt-tiles">
            <ProviderTile label="Content AI" detail={dashboard.providers.openrouter.model} connected={dashboard.providers.openrouter.connected} copy={copy} />
            <ProviderTile
              label={zh ? "社媒投放" : "Social delivery"}
              detail={dashboard.providers.zernio.connected ? `${dashboard.providers.zernio.configuredPlatforms.length} ${copy.platformsUnit}` : null}
              connected={dashboard.providers.zernio.connected}
              copy={copy}
            />
            <ProviderTile label="Google Analytics 4" detail={null} connected={dashboard.providers.ga4.connected} copy={copy} />
            <ProviderTile label="Search Console" detail={null} connected={dashboard.providers.searchConsole.connected} copy={copy} />
          </div>
        </PortalSection>
      </PortalStack>
    </PortalPage>
  );
}

function ProviderTile({
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  PublicStatusIncident,
  PublicStatusMonitor,
  PublicStatusSnapshot,
  PublicMonitorStatus,
} from "@/lib/public-status";

interface StatusClientProps {
  initialSnapshot: PublicStatusSnapshot;
  locale: string;
}

type SubTab = "current" | "incidents";
type UiStatus = "op" | "deg" | "maj" | "none";

function uiStatus(status: PublicMonitorStatus): UiStatus {
  if (status === "ok") return "op";
  if (status === "degraded") return "deg";
  if (status === "down") return "maj";
  return "none";
}

function isStale(monitor: PublicStatusMonitor, staleAfterSeconds: number, now: number): boolean {
  if (!monitor.lastCheckedAt) return true;
  const checkedAt = Date.parse(monitor.lastCheckedAt);
  return !Number.isFinite(checkedAt) || now - checkedAt > staleAfterSeconds * 1_000;
}

function monitorStatus(
  monitor: PublicStatusMonitor,
  staleAfterSeconds: number,
  now: number,
): PublicMonitorStatus {
  return isStale(monitor, staleAfterSeconds, now) ? "unknown" : monitor.status;
}

function datesForWindow(days: number): string[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (days - index - 1));
    return date.toISOString().slice(0, 10);
  });
}

function localized(value: { en: string; "zh-CN": string }, locale: string): string {
  return locale === "zh-CN" ? value["zh-CN"] : value.en;
}

function formatTimestamp(value: string | null, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore",
  }).format(date);
}

function groupIncidents(incidents: PublicStatusIncident[]): Array<[string, PublicStatusIncident[]]> {
  const grouped = new Map<string, PublicStatusIncident[]>();
  for (const incident of incidents) {
    const day = incident.startedAt.slice(0, 10);
    grouped.set(day, [...(grouped.get(day) ?? []), incident]);
  }
  return [...grouped.entries()];
}

export default function StatusClient({ initialSnapshot, locale }: StatusClientProps) {
  const t = useTranslations("status");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [search, setSearch] = useState("");
  const [activeSub, setActiveSub] = useState<SubTab>("current");
  const [now, setNow] = useState(() => {
    const generatedAt = Date.parse(initialSnapshot.generatedAt);
    return Number.isFinite(generatedAt) ? generatedAt : 0;
  });

  useEffect(() => {
    const refresh = async () => {
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        if (!response.ok) return;
        const next = await response.json() as PublicStatusSnapshot;
        if (next.version === 1 && Array.isArray(next.monitors) && Array.isArray(next.incidents)) {
          setSnapshot(next);
        }
      } catch {
        // Keep the last verified snapshot. Staleness handling below will turn
        // it unknown when its evidence ages past the declared threshold.
      }
      setNow(Date.now());
    };
    const interval = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const platform = snapshot.monitors.filter((monitor) => monitor.type === "platform");
  const portals = snapshot.monitors.filter((monitor) => monitor.type === "government_portal");
  const query = search.trim().toLocaleLowerCase(locale);
  const visiblePortals = portals.filter((monitor) => {
    const name = localized(monitor.name, locale).toLocaleLowerCase(locale);
    return !query || name.includes(query) || monitor.code?.toLocaleLowerCase(locale).includes(query);
  });
  const statuses = snapshot.monitors.map((monitor) => monitorStatus(monitor, snapshot.staleAfterSeconds, now));
  const overallStatus = snapshot.monitors.length === 0 || statuses.every((status) => status === "unknown")
    ? "unknown"
    : statuses.includes("down")
      ? "down"
      : statuses.includes("degraded") || statuses.includes("unknown")
        ? "degraded"
        : "ok";
  const latestCheck = snapshot.monitors.reduce<string | null>((latest, monitor) => {
    if (!monitor.lastCheckedAt) return latest;
    if (!latest || Date.parse(monitor.lastCheckedAt) > Date.parse(latest)) return monitor.lastCheckedAt;
    return latest;
  }, null);
  const activeIncidents = snapshot.incidents.filter((incident) => !incident.resolvedAt);
  const incidentGroups = useMemo(() => groupIncidents(snapshot.incidents), [snapshot.incidents]);
  const windowDates = useMemo(() => datesForWindow(90), []);

  const overallTitle = overallStatus === "ok"
    ? t("console.allOperational")
    : overallStatus === "down"
      ? t("console.majorOutage")
      : overallStatus === "degraded"
        ? t("console.degraded")
        : t("console.dataUnavailable");

  const renderBars = (monitor: PublicStatusMonitor) => {
    const byDate = new Map(monitor.days.map((day) => [day.date, day]));
    return windowDates.map((date) => {
      const day = byDate.get(date);
      const status = day?.status ?? "unknown";
      const title = day
        ? t("dayObservation", { date, checks: day.checks })
        : t("dayNoData", { date });
      return <div key={date} className={`uptime-bar ${uiStatus(status)}`} title={title} />;
    });
  };

  const statusLabel = (status: PublicMonitorStatus) => t(`statusLabels.${uiStatus(status)}`);
  const renderMonitor = (monitor: PublicStatusMonitor, featured = false) => {
    const effective = monitorStatus(monitor, snapshot.staleAfterSeconds, now);
    const statusClass = uiStatus(effective);
    const uptime = monitor.uptime90d == null ? "—" : `${monitor.uptime90d.toFixed(2)}%`;
    return (
      <div className={featured ? "feat" : "row"} key={monitor.id}>
        <div className={featured ? "feat-title" : "row-title"}>
          <div className={featured ? "mark" : "iso"}>{monitor.code ?? "—"}</div>
          <div className="ti">
            {featured
              ? <h4>{localized(monitor.name, locale)}</h4>
              : <h5>{localized(monitor.name, locale)}</h5>}
            <div className="sub">{localized(monitor.description, locale)}</div>
          </div>
        </div>
        <div className="uptime">
          <div className="uptime-bars">{renderBars(monitor)}</div>
          <div className="uptime-foot">
            <span>{t("uptime.ago")}</span>
            <strong>{monitor.uptime90d == null ? t("uptime.noData") : t("uptime.pct", { pct: monitor.uptime90d.toFixed(2) })}</strong>
            <span>{t("uptime.today")}</span>
          </div>
        </div>
        <div className="row-stat">
          <div className={`pct ${statusClass}`}>{statusLabel(effective)}</div>
          <div className="lbl">
            {effective === "unknown"
              ? t("monitorStale")
              : t("lastChecked", { time: formatTimestamp(monitor.lastCheckedAt, locale) })}
          </div>
          <span className="sr-only">{uptime}</span>
        </div>
      </div>
    );
  };

  return (
    <>
      <section className="hero" data-screen-label="Hero">
        <div className="hero-inner">
          <div className="crumb">
            <a href="/">{t("crumbHome")}</a>
            <span className="arr">›</span>
            <span className="here">{t("crumbHere")}</span>
          </div>
          <div className="hero-grid">
            <div>
              <h1>{t.rich("hero.title", { em: (chunks) => <em>{chunks}</em>, br: () => <br /> })}</h1>
              <p className="lead">{t("hero.lead")}</p>
            </div>
            <div className={`console console-${uiStatus(overallStatus)}`}>
              <div className="console-head">
                <span>{t("console.title")}</span>
                <span className="live">{overallStatus === "unknown" ? t("console.unverified") : t("console.live")}</span>
              </div>
              <div className="console-body">
                <div className="console-state">
                  <div className="ico" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h2>
                    {overallTitle}
                    <small>{latestCheck ? t("console.lastChecked", { time: formatTimestamp(latestCheck, locale) }) : t("console.noChecks")}</small>
                  </h2>
                </div>
                <div className="console-numbers">
                  <div className="console-num">
                    <div className="v">{snapshot.summary.uptime90d == null ? "—" : `${snapshot.summary.uptime90d.toFixed(2)}%`}</div>
                    <div className="k">{t("console.kUptime")}</div>
                  </div>
                  <div className="console-num">
                    <div className="v">{snapshot.monitors.length}</div>
                    <div className="k">{t("console.kMonitors")}</div>
                  </div>
                  <div className="console-num">
                    <div className="v">{activeIncidents.length}</div>
                    <div className="k">{t("console.kIncidents")}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="subnav">
        <div className="subnav-inner">
          <div className="sub-tabs">
            <a className={`sub-tab ${activeSub === "current" ? "active" : ""}`} href="#current" onClick={() => setActiveSub("current")}>
              {t("subnav.current")} <span className="cnt">{snapshot.monitors.length}</span>
            </a>
            <a className={`sub-tab ${activeSub === "incidents" ? "active" : ""}`} href="#incidents" onClick={() => setActiveSub("incidents")}>
              {t("subnav.incidents")}
            </a>
          </div>
          <div className="search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input type="search" placeholder={t("subnav.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>
      </div>

      <main className="page" id="current">
        {snapshot.monitors.length === 0 ? (
          <section className="panel empty-state">
            <h2>{t("console.dataUnavailable")}</h2>
            <p>{t("monitoringUnavailable")}</p>
          </section>
        ) : null}

        {platform.length > 0 ? (
          <section className="panel">
            <div className="panel-head">
              <h3>{t("platform.title")}</h3>
              <span className="meta"><span className="pulse" />{t("platform.realMeta", { count: platform.length })}</span>
            </div>
            {platform.map((monitor) => renderMonitor(monitor, true))}
          </section>
        ) : null}

        <div className="panel-section-head">
          <div>
            <h2>{t("portalsHead.title")}</h2>
            <p>{t("portalsHead.lead")}</p>
          </div>
          <div className="legend">
            <span className="legend-item"><span className="legend-sw op" />{t("statusLabels.op")}</span>
            <span className="legend-item"><span className="legend-sw de" />{t("statusLabels.deg")}</span>
            <span className="legend-item"><span className="legend-sw mj" />{t("statusLabels.maj")}</span>
            <span className="legend-item"><span className="legend-sw none" />{t("statusLabels.none")}</span>
          </div>
        </div>

        <section className="panel" id="portalList">
          {visiblePortals.map((monitor) => renderMonitor(monitor))}
          {portals.length === 0 ? <div className="empty-state">{t("monitoringUnavailable")}</div> : null}
          {portals.length > 0 && visiblePortals.length === 0 ? <div className="empty-state">{t("noSearchResults")}</div> : null}
        </section>

        <div className="panel-section-head" id="incidents">
          <div>
            <h2>{t("incidentsHead.title")}</h2>
            <p>{t("incidentsHead.lead")}</p>
          </div>
        </div>

        <section className="panel" id="incidentList">
          {incidentGroups.length === 0 ? <div className="empty-state">{t("noRecordedIncidents")}</div> : null}
          {incidentGroups.map(([day, incidents]) => (
            <div className="day-group" key={day}>
              <div className="day-head">
                <span className="date">{new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "Asia/Singapore" }).format(new Date(`${day}T00:00:00+08:00`))}</span>
                <span className="count">{t("incidentCount", { count: incidents.length })}</span>
              </div>
              {incidents.map((incident) => {
                const monitor = snapshot.monitors.find((item) => item.id === incident.monitorId);
                return (
                  <div className="incident" key={incident.id}>
                    <div className="incident-country">
                      <div className="iso">{monitor?.code ?? "—"}</div>
                      <div className="ni">
                        <h5>{monitor ? localized(monitor.name, locale) : incident.monitorId}</h5>
                        <div className="when">{formatTimestamp(incident.startedAt, locale)}</div>
                      </div>
                    </div>
                    <div className="incident-events">
                      <div className="ev">
                        <span className="time">{formatTimestamp(incident.startedAt, locale)}</span>
                        <span className={`tag ${incident.resolvedAt ? "resolved" : "investigating"}`}>
                          <span className="d" />{incident.resolvedAt ? t("tags.resolved") : t("tags.investigating")}
                        </span>
                        <span className="desc">{localized(incident.summary, locale)}</span>
                      </div>
                      {incident.resolvedAt ? (
                        <div className="ev">
                          <span className="time">{formatTimestamp(incident.resolvedAt, locale)}</span>
                          <span className="tag resolved"><span className="d" />{t("tags.resolved")}</span>
                          <span className="desc">{t("incidentRecovered")}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      </main>
    </>
  );
}

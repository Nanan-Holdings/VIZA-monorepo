import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface Row {
  country: string;
  week_start: string;
  success: boolean;
  time_to_submit_s: number | null;
  captcha_cost_cents: number;
  proxy_cost_cents: number;
}

interface Bucket {
  total: number;
  succeeded: number;
  ttsSum: number;
  ttsCount: number;
  captchaCents: number;
  proxyCents: number;
}

export interface PoolConcurrencyHealth {
  country: string;
  max_concurrent: number;
  paused: boolean;
  claimable: number;
  scheduled: number;
  running: number;
  expired_running: number;
  capacity_headroom: number;
  oldest_claimable_at: string | null;
  oldest_claimable_age_seconds: number | null;
}

export interface SlotCapacityHealth {
  max_slots: number;
  live_slots: number;
  free_slots: number;
  pool_live_slots: number;
  sticky_live_slots: number;
  expired_owned_slots: number;
  stale_renewal_slots: number;
  utilization_percent: number;
}

export interface ConcurrencyMetric {
  event_type: "claim" | "machine_start";
  outcome: string;
  duration_ms: number | null;
  country: string | null;
  machine_kind: string | null;
  count: number;
  recorded_at: string;
}

export interface ConcurrencyAlertInput {
  poolHealth: readonly PoolConcurrencyHealth[];
  slotHealth: SlotCapacityHealth | null;
  metrics: readonly ConcurrencyMetric[];
}

export type ConcurrencyAlert =
  | "capacity_health_unavailable"
  | "claim_metrics_unavailable"
  | "claim_p95_high"
  | "oldest_claimable_high"
  | "capacity_overshoot"
  | "expired_slots"
  | "stale_slot_renewals";

const SUCCESS_RATE_THRESHOLD = 0.9;

const COPY = {
  en: {
    title: "Runner KPIs",
    subtitle: "Weekly submission outcomes and live shared-runner capacity.",
    unavailable: "Operational capacity data is unavailable",
    unavailableDetail: "The required health view or metric table is missing or failed. No green status is shown.",
    capacity: "Live capacity",
    capacitySubtitle: "DB-backed shared pool and sticky slot health",
    slots: "Slots",
    utilization: "Slot utilization",
    freeSlots: "Free slots",
    running: "Running / cap",
    oldest: "Oldest claimable",
    claimP95: "Claim p95",
    machineStarts: "Machine starts (24h)",
    machineStartP95: "Machine start request p95",
    noSamples: "No recent samples",
    noClaimable: "No claimable work",
    alerts: "Concurrency alerts",
    alertClaimP95: "Claim latency p95 is at least 500 ms.",
    alertOldest: "Claimable work is older than 120 seconds while a slot is free.",
    alertOvershoot: "A country is running above its configured cap.",
    alertExpired: "One or more expired running jobs or owned slots are still visible.",
    alertStale: "One or more live slots have not renewed for roughly three intervals.",
    alertCapacityUnavailable: "Capacity health is unavailable; verify the migration and service-role access.",
    alertClaimMetricsUnavailable: "Claim latency samples are unavailable; verify runner metric emission.",
    country: "Country",
    below: "Success rate below",
    currentWeek: "current week",
    over: "over",
    cellFormat: "Cell format: success rate / total jobs · average time-to-submit · USD captcha+proxy spend.",
    seconds: "s",
  },
  zh: {
    title: "Runner 指标",
    subtitle: "每周提交结果与共享 Runner 实时容量。",
    unavailable: "运营容量数据不可用",
    unavailableDetail: "所需健康视图或指标表缺失或查询失败；不会显示绿色正常状态。",
    capacity: "实时容量",
    capacitySubtitle: "数据库共享池与专用槽位健康度",
    slots: "槽位",
    utilization: "槽位使用率",
    freeSlots: "空闲槽位",
    running: "运行中 / 上限",
    oldest: "最早可领取",
    claimP95: "领取 p95",
    machineStarts: "机器启动（24 小时）",
    machineStartP95: "机器启动请求 p95",
    noSamples: "暂无近期样本",
    noClaimable: "暂无可领取任务",
    alerts: "并发告警",
    alertClaimP95: "领取延迟 p95 达到 500 毫秒或更高。",
    alertOldest: "有空闲槽位时，可领取任务已等待超过 120 秒。",
    alertOvershoot: "某国家运行数超过配置上限。",
    alertExpired: "仍可见一个或多个已过期运行任务或有所有者的槽位。",
    alertStale: "一个或多个活动槽位约三个续租周期未更新。",
    alertCapacityUnavailable: "容量健康数据不可用；请检查迁移和 service-role 权限。",
    alertClaimMetricsUnavailable: "领取延迟样本不可用；请检查 Runner 指标上报。",
    country: "国家",
    below: "成功率低于",
    currentWeek: "当前周",
    over: "共",
    cellFormat: "单元格格式：成功率 / 总作业数 · 平均提交耗时 · 验证码+代理 USD 成本。",
    seconds: "秒",
  },
} as const;

export function percentile(values: readonly number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return sorted[index];
}

export function deriveConcurrencyAlerts(input: ConcurrencyAlertInput): ConcurrencyAlert[] {
  const alerts: ConcurrencyAlert[] = [];
  if (!input.slotHealth || input.poolHealth.length === 0) alerts.push("capacity_health_unavailable");
  const claimDurations = input.metrics
    .filter((metric) => metric.event_type === "claim" && metric.duration_ms != null)
    .map((metric) => Number(metric.duration_ms))
    .filter((duration) => Number.isFinite(duration) && duration >= 0);
  if (claimDurations.length === 0) alerts.push("claim_metrics_unavailable");
  const claimP95 = percentile(claimDurations, 0.95);
  if (claimP95 != null && claimP95 >= 500) alerts.push("claim_p95_high");

  const oldestClaimableAge = input.poolHealth.reduce((maxAge, row) => {
    if (Number(row.claimable) <= 0) return maxAge;
    return Math.max(maxAge, Number(row.oldest_claimable_age_seconds ?? 0));
  }, 0);
  if (oldestClaimableAge > 120 && Number(input.slotHealth?.free_slots ?? 0) > 0) {
    alerts.push("oldest_claimable_high");
  }
  if (input.poolHealth.some((row) => Number(row.running) > Number(row.max_concurrent))) {
    alerts.push("capacity_overshoot");
  }
  const expiredRunning = input.poolHealth.some((row) => Number(row.expired_running) > 0);
  if (expiredRunning || Number(input.slotHealth?.expired_owned_slots ?? 0) > 0) alerts.push("expired_slots");
  if (Number(input.slotHealth?.stale_renewal_slots ?? 0) > 0) alerts.push("stale_slot_renewals");
  return alerts;
}

function makeBucket(): Bucket {
  return {
    total: 0,
    succeeded: 0,
    ttsSum: 0,
    ttsCount: 0,
    captchaCents: 0,
    proxyCents: 0,
  };
}

function formatDuration(durationMs: number | null, copy: { noSamples: string }): string {
  return durationMs == null ? copy.noSamples : `${Math.round(durationMs)} ms`;
}

export default async function AdminMetricsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];
  const admin = createAdminClient();

  const sinceIso = new Date(Date.now() - 8 * 7 * 24 * 3600 * 1000).toISOString();
  const runtimeSinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [metricsQuery, poolQuery, slotQuery, dataQuery] = await Promise.all([
    admin
      .from("runner_concurrency_metric")
      .select("event_type, outcome, duration_ms, country, machine_kind, count, recorded_at")
      .gte("recorded_at", runtimeSinceIso)
      .order("recorded_at", { ascending: false })
      .limit(5000),
    admin
      .from("runner_pool_concurrency_health")
      .select("country, max_concurrent, paused, claimable, scheduled, running, expired_running, capacity_headroom, oldest_claimable_at, oldest_claimable_age_seconds"),
    admin
      .from("runner_slot_capacity_health")
      .select("max_slots, live_slots, free_slots, pool_live_slots, sticky_live_slots, expired_owned_slots, stale_renewal_slots, utilization_percent"),
    admin
      .from("runner_metric")
      .select("country, week_start, success, time_to_submit_s, captcha_cost_cents, proxy_cost_cents")
      .gte("ts", sinceIso)
      .order("week_start", { ascending: false }),
  ]);

  const runtimeErrors = [metricsQuery.error, poolQuery.error, slotQuery.error]
    .map((error) => error?.message)
    .filter((message): message is string => Boolean(message));
  const poolHealth = (poolQuery.data ?? []) as unknown as PoolConcurrencyHealth[];
  const slotHealth = ((slotQuery.data ?? []) as unknown as SlotCapacityHealth[])[0] ?? null;
  const concurrencyMetrics = (metricsQuery.data ?? []) as unknown as ConcurrencyMetric[];
  const alerts = deriveConcurrencyAlerts({ poolHealth, slotHealth, metrics: concurrencyMetrics });
  const claimP95 = percentile(
    concurrencyMetrics
      .filter((metric) => metric.event_type === "claim" && metric.duration_ms != null)
      .map((metric) => Number(metric.duration_ms))
      .filter((duration) => Number.isFinite(duration) && duration >= 0),
    0.95,
  );
  const machineStartMetrics = concurrencyMetrics.filter((metric) => metric.event_type === "machine_start");
  const machineStartP95 = percentile(
    machineStartMetrics
      .map((metric) => metric.duration_ms)
      .filter((duration): duration is number => duration != null && Number.isFinite(duration) && duration >= 0),
    0.95,
  );
  const oldestClaimableAge = poolHealth.reduce((maxAge, row) => {
    if (Number(row.claimable) <= 0) return maxAge;
    return Math.max(maxAge, Number(row.oldest_claimable_age_seconds ?? 0));
  }, 0);
  const totalRunning = poolHealth.reduce((total, row) => total + Number(row.running), 0);
  const totalCap = poolHealth.reduce((total, row) => total + Number(row.max_concurrent), 0);

  const dataError = dataQuery.error?.message;
  const rows = (dataQuery.data ?? []) as unknown as Row[];
  const buckets = new Map<string, Bucket>();
  const weeks = new Set<string>();
  const countries = new Set<string>();
  for (const row of rows) {
    weeks.add(row.week_start);
    countries.add(row.country);
    const key = `${row.country}|${row.week_start}`;
    const bucket = buckets.get(key) ?? makeBucket();
    bucket.total += 1;
    if (row.success) {
      bucket.succeeded += 1;
      if (row.time_to_submit_s != null) {
        bucket.ttsSum += row.time_to_submit_s;
        bucket.ttsCount += 1;
      }
    }
    bucket.captchaCents += row.captcha_cost_cents;
    bucket.proxyCents += row.proxy_cost_cents;
    buckets.set(key, bucket);
  }
  const sortedWeeks = Array.from(weeks).sort().reverse();
  const sortedCountries = Array.from(countries).sort();
  const currentWeek = sortedWeeks[0];
  const weeklyAlerts: Array<{ country: string; rate: number; total: number }> = [];
  if (currentWeek) {
    for (const country of sortedCountries) {
      const bucket = buckets.get(`${country}|${currentWeek}`);
      if (!bucket || bucket.total < 5) continue;
      const rate = bucket.succeeded / bucket.total;
      if (rate < SUCCESS_RATE_THRESHOLD) weeklyAlerts.push({ country, rate, total: bucket.total });
    }
  }

  const alertCopy: Record<ConcurrencyAlert, string> = {
    capacity_health_unavailable: copy.alertCapacityUnavailable,
    claim_metrics_unavailable: copy.alertClaimMetricsUnavailable,
    claim_p95_high: copy.alertClaimP95,
    oldest_claimable_high: copy.alertOldest,
    capacity_overshoot: copy.alertOvershoot,
    expired_slots: copy.alertExpired,
    stale_slot_renewals: copy.alertStale,
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#232323]">{copy.title}</h1>
        <p className="text-sm text-[#6b6b6b]">{copy.subtitle}</p>
      </div>

      {runtimeErrors.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">{copy.unavailable}</p>
          <p className="mt-1">{copy.unavailableDetail}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-xs">
            {runtimeErrors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      ) : null}

      <section className="rounded-lg border border-[#efefef] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-[#232323]">{copy.capacity}</h2>
            <p className="text-xs text-[#6b6b6b]">{copy.capacitySubtitle}</p>
          </div>
          <span className="text-xs text-[#6b6b6b]">24h</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label={copy.slots} value={slotHealth ? `${slotHealth.live_slots} / ${slotHealth.max_slots}` : "—"} />
          <MetricCard label={copy.utilization} value={slotHealth ? `${Number(slotHealth.utilization_percent).toFixed(1)}%` : "—"} />
          <MetricCard label={copy.freeSlots} value={slotHealth ? String(slotHealth.free_slots) : "—"} />
          <MetricCard label={copy.running} value={poolHealth.length ? `${totalRunning} / ${totalCap}` : "—"} />
          <MetricCard label={copy.oldest} value={oldestClaimableAge > 0 ? `${Math.round(oldestClaimableAge)} ${copy.seconds}` : copy.noClaimable} />
          <MetricCard label={copy.claimP95} value={formatDuration(claimP95, copy)} />
          <MetricCard label={copy.machineStarts} value={String(machineStartMetrics.length)} />
          <MetricCard label={copy.machineStartP95} value={formatDuration(machineStartP95, copy)} />
        </div>
      </section>

      {alerts.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <h2 className="font-semibold">{copy.alerts}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {alerts.map((alert) => <li key={alert}>{alertCopy[alert]}</li>)}
          </ul>
        </section>
      ) : null}

      {weeklyAlerts.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            {copy.below} {(SUCCESS_RATE_THRESHOLD * 100).toFixed(0)}% {copy.currentWeek}
          </p>
          <ul className="mt-2 list-disc list-inside text-sm text-amber-800">
            {weeklyAlerts.map((alert) => (
              <li key={alert.country}>{alert.country}: {(alert.rate * 100).toFixed(1)}% {copy.over} {alert.total}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {dataError ? <p className="text-sm text-red-600">{dataError}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-[#efefef] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-[#fafafa]">
              <th className="px-3 py-2 text-left font-medium text-[#6b6b6b]">{copy.country}</th>
              {sortedWeeks.map((week) => <th key={week} className="px-3 py-2 text-right font-medium text-[#6b6b6b]">{week}</th>)}
            </tr>
          </thead>
          <tbody>
            {sortedCountries.map((country) => (
              <tr key={country} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{country}</td>
                {sortedWeeks.map((week) => {
                  const bucket = buckets.get(`${country}|${week}`);
                  if (!bucket) return <td key={week} className="px-3 py-2 text-right text-xs text-[#9ca3af]">—</td>;
                  const rate = bucket.succeeded / Math.max(1, bucket.total);
                  const tts = bucket.ttsCount > 0 ? Math.round(bucket.ttsSum / bucket.ttsCount) : null;
                  const cost = ((bucket.captchaCents + bucket.proxyCents) / 100).toFixed(2);
                  return (
                    <td key={week} className="px-3 py-2 text-right text-xs font-mono">
                      <span className={rate < SUCCESS_RATE_THRESHOLD && bucket.total >= 5 ? "font-semibold text-red-600" : "text-[#232323]"}>
                        {(rate * 100).toFixed(0)}% / {bucket.total}
                      </span>
                      <br />
                      <span className="text-[#6b6b6b]">{tts != null ? `${tts}${copy.seconds}` : "—"} · ${cost}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[#6b6b6b]">{copy.cellFormat}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#edf0f4] bg-[#fafbfc] p-3">
      <p className="text-xs text-[#6b6b6b]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#232323]">{value}</p>
    </div>
  );
}

# Residential / mobile proxy pool (INFRA-004)

> Last reviewed: 2026-05-07.

## Choice — Bright Data residential, with per-country sticky sessions

Provider: **Bright Data Residential Proxy Network**.

Reasons:

- Largest residential pool (~150M IPs) with explicit per-country and
  per-city geotargeting via the username convention (zone, country,
  session id, sticky duration).
- Native sticky-session support: appending `-session-<rand>` to the
  username glues the same upstream IP to a runner job for the
  duration of the lease.
- IPRoyal and Oxylabs were considered. IPRoyal is cheaper but has
  thinner coverage in our edge markets (Macau, Maldives, Sri Lanka).
  Oxylabs is comparable to Bright Data; preferred Bright Data on the
  back of better existing playbook docs.

## Per-country overrides — when in-country IPs are mandatory

Most flows are happy on a residential IP geolocated to the
applicant's claimed country. A few corridors require an in-country
egress IP regardless of who the applicant is:

| Country / corridor | Reason | Egress override |
|---|---|---|
| Italy via VFS-CN (Schengen) | The `vfsglobal.com` PRC mirror geo-fences requests; from outside CN it serves a different (and incomplete) flow. | `country=CN` (Bright Data CN city = Shanghai) |
| US CEAC DS-160 | CEAC anti-bot is aggressive against datacentre IPs but tolerant of US residential. | `country=US` (matches applicant only when US-resident; otherwise route via the closest US residential pool to spoof the IP-vs-form mismatch tolerance window). |
| Vietnam e-Visa | Permits any IP; we still pin to `country=VN` to keep the user-agent's locale fingerprint coherent. | `country=VN` |
| UK Apply UK Visa | UKVI portal handles foreign IPs cleanly; no override. | applicant country |

The override map lives in
`viza-be/submission-service/src/proxy/country-overrides.ts` and is
the single source of truth — runners look up the override here, the
`runner_concurrency_cap` doc references it, and the deploy driver
(Fly Machines, INFRA-003) uses it to decide which region a worker
should run in.

## Helper API

```ts
import { getProxyForApplicant } from "./proxy/get-proxy";

const proxy = await getProxyForApplicant(applicantId, "vietnam", {
  workerId: "worker-vn-1",
  jobId: "job-uuid",
});
// proxy.host, proxy.port, proxy.username, proxy.password are passed
// to Playwright as `proxy: { server, username, password }`.
// proxy.sessionId is the sticky-session token; it lands in the
// runner_job.metadata bag for forensic replay.
```

## Artefact registration

Every runner records the proxy session it used. The bookkeeping is
already on `runner_job.metadata`:

```jsonc
{
  "proxy": {
    "provider": "brightdata",
    "country": "vietnam",
    "session_id": "viza-vn-eu5cphtzgpa1n",
    "city": null,
    "sticky_minutes": 30
  }
}
```

When a portal complains about an IP, ops can search
`runner_job.metadata->'proxy'->>'session_id'` to find every job that
shared the upstream IP and re-run them with a fresh session.

## Required env

```
BRIGHTDATA_PROXY_HOST = brd.superproxy.io
BRIGHTDATA_PROXY_PORT = 22225
BRIGHTDATA_USERNAME   = brd-customer-<id>-zone-<zone>
BRIGHTDATA_PASSWORD   = … (treat as a vault secret; rotate quarterly)
```

The credentials are platform-wide (single Bright Data zone shared
across all per-applicant runs). Don't store them in
`applicant_secret` — they're not per-applicant. Live in the
container env / Cloud Run secret manager.

## Cost guard-rail

Bright Data bills per-GB of egress. For each runner job we record
the bytes transferred (Playwright exposes `request.totalBytesUsed`
on `Page.metrics()`-equivalent in Bright Data's dashboard). The
`order_line` row tagged `kind='third_party_proxy'` carries the
USD-equivalent cost so it lands on the gross-margin view
(`/admin/revenue`, PAY-007).

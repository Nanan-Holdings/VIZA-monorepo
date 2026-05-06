# Cloudflare Email Routing — `haggstorm.com` baseline

> Last reviewed: 2026-05-06 (INBOX-001)

This is the runbook for the inbound mail layer that backs the
per-applicant alias system (INBOX-002 → INBOX-007). It documents the
Cloudflare configuration that owns `haggstorm.com` MX, the canary
alias used to prove the path, and the rollback to detach the domain
without losing data.

## Goals

1. Receive mail to any address under `haggstorm.com` via Cloudflare
   Email Routing (free tier, 100k messages/day).
2. Forward a canary alias `inbox-canary@haggstorm.com` to a maintainer
   mailbox so we can monitor reachability without standing up the
   Worker yet.
3. Have all DNS state checked into this document so a rollback or a
   change of provider can be executed by anyone with Cloudflare admin
   access.

This story is **ops + write-up**. Items 1–3 are dashboard actions
performed by the maintainer; this document is the durable artefact.

## One-time setup

### 1. Enable Email Routing in the Cloudflare dashboard

```
Cloudflare → haggstorm.com → Email → Email Routing → Get started
```

Cloudflare will offer to add the required MX, SPF (TXT), and DKIM
records automatically. **Accept the auto-record creation.** The records
should resolve to:

| Type | Name | Value | Priority |
|---|---|---|---|
| MX | haggstorm.com | route1.mx.cloudflare.net | 13 |
| MX | haggstorm.com | route2.mx.cloudflare.net | 86 |
| MX | haggstorm.com | route3.mx.cloudflare.net | 24 |
| TXT | haggstorm.com | `v=spf1 include:_spf.mx.cloudflare.net ~all` | — |

The exact priorities and host names are assigned by Cloudflare; record
the values produced for the live setup in the table above when this
runbook is updated post-provisioning.

DKIM is generated lazily — Cloudflare adds a `cf2024-1._domainkey`
CNAME pointing into the Cloudflare DKIM service the first time a
forward is attempted. Verify after step 3 below.

### 2. Verify DNS

From any host:

```
dig +short MX haggstorm.com
dig +short TXT haggstorm.com | grep spf1
dig +short CNAME cf2024-1._domainkey.haggstorm.com   # populated after first send
```

All three should return Cloudflare-managed values. Cloudflare's UI
shows a green "Verified" pill next to each record once propagation is
complete (usually < 5 minutes for an Anthropic-managed zone).

### 3. Canary alias

Add a single forward:

```
Cloudflare → haggstorm.com → Email → Email Routing → Routes
  Custom address:  inbox-canary@haggstorm.com
  Action:          Send to an email
  Destination:     edward.zehua.zhang@gmail.com   # maintainer mailbox
```

**Confirm the destination address from the link in the verification
email** before the route becomes active. Cloudflare requires every
forward destination to be opt-in.

### 4. Send a canary message

```
echo "INBOX-001 canary $(date -u +%FT%TZ)" | \
  mail -s "INBOX-001 canary" inbox-canary@haggstorm.com
```

(or use any external mail client.) Within a minute the message should
land in the maintainer mailbox with a `Received:` header showing
`route*.mx.cloudflare.net`. Capture the headers in the
`#viza-ops` log entry recording this run.

## DNS state (snapshot)

Update this section whenever DNS changes. Snapshot from the most
recent provisioning run:

| Record | Status | Last verified |
|---|---|---|
| MX route1.mx.cloudflare.net (priority 13) | _pending live verification_ | — |
| MX route2.mx.cloudflare.net (priority 86) | _pending live verification_ | — |
| MX route3.mx.cloudflare.net (priority 24) | _pending live verification_ | — |
| TXT `v=spf1 include:_spf.mx.cloudflare.net ~all` | _pending live verification_ | — |
| CNAME cf2024-1._domainkey | _provisioned on first send_ | — |

After the maintainer completes the dashboard steps, fill in the
`Status` and `Last verified` columns and commit the update.

## Rollback

If we need to detach `haggstorm.com` from Cloudflare Email Routing
(e.g. moving to a self-hosted MX, or onboarding a different provider):

1. Cloudflare → Email → Email Routing → **Disable Email Routing.** This
   removes the MX records but leaves any audit logs intact for 30
   days.
2. Add the replacement MX records for the new provider in the same DNS
   zone. Bump TTL to 300 first to make swaps fast; restore to 3600
   after the cutover settles.
3. The Email Worker (INBOX-002, when it lands) is bound to the same
   zone — disabling Email Routing also stops the worker from receiving
   messages. No additional cleanup is needed there.
4. The Supabase `inbound_email` table (INBOX-002) and the per-applicant
   alias map (INBOX-003) are independent of Cloudflare and remain
   queryable. Document the cut-over in this file.

## Failure modes

- **Maintainer destination not verified.** Cloudflare silently drops
  routes whose destination address has not confirmed the opt-in email.
  Re-trigger the destination verification from the dashboard.
- **MX records out of sync after a DNS change.** Use the `dig` checks
  above and force `cloudflared dns flush` if running cloudflared on
  the worker host. End-to-end propagation can take up to 24h on
  third-party resolvers; for the canary, expect under 5 minutes.
- **Cloudflare 50x bounce.** The sending side will see a temporary
  failure (`421`) and retry per RFC 5321. No action required unless
  the failure persists past 30 minutes — escalate to Cloudflare
  support with the `cf-ray` from the bounce.

## Next gates

- INBOX-002 stands up the Email Worker that ingests inbound mail to
  Supabase + R2.
- INBOX-003 generates per-applicant aliases and the runner-facing
  `inbox.waitForMessage` helper.
- INBOX-007 layers retention + abuse rules on top.

# Bright Data zone (PROV-005 / DATA-008)

## Layout

| Where                                                | Contract                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `viza-be/submission-service/src/browser/stealth-browser.ts` | Launches Playwright with Bright Data proxy auth headers (existing).         |
| `viza-be/submission-service/src/runner/proxy-pool.ts`       | `pickStickySession` / `markChallenged` / `markSuccess` against `proxy_pool` |
| `viza-be/submission-service/scripts/seed-proxy-pool.ts`     | Bootstraps `proxy_pool` from a Bright Data CSV allocation                   |

## Human handoff

1. Buy a Bright Data residential zone with sticky-IP support; note the zone name (e.g. `viza_prod`).
2. Export the IP allocation CSV from Bright Data (columns `ip,region`).
3. Set envs on the deploy target:
   ```
   BRIGHTDATA_USER=<zone-user>
   BRIGHTDATA_PASSWORD = <zone-password>
   BRIGHTDATA_ZONE=viza_prod
   ```
4. Seed `proxy_pool`:
   ```bash
   cd viza-be/submission-service
   BRIGHTDATA_ZONE=viza_prod npx ts-node scripts/seed-proxy-pool.ts /tmp/bd-ips.csv
   ```
   Use `PROXY_SEED_DRY=1` first to preview.
5. Confirm `pickStickySession` returns a row:
   ```bash
   psql "$DATABASE_URL" -c "select count(*) from proxy_pool where is_active and (cooled_until is null or cooled_until <= now());"
   ```

## Cooldown semantics

- Single anti-bot trip → 30 min cooldown.
- 3 trips in a row on the same IP → escalates to 4h.
- `markSuccess` resets the streak.

## Region balance

Keep at least 10 active rows in each of US / EU / SEA so the cooldown algorithm has alternatives to pick from. The seeder accepts any region label; the runner only filters when `pickStickySession({ region })` is called.

## Rotation

`BRIGHTDATA_PASSWORD` rotates quarterly per `docs/security/secret-rotation.md`. After rotation, re-seed `proxy_pool` (the password change doesn't invalidate IPs but does invalidate runner-side caches).

# Sentry wiring (PROV-003 / FIX-006)

## Layout

| Where                                                          | What                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| `viza-fe/internal-website/lib/observability/sentry.ts`         | Shared `buildSentryInitOptions()` — release, env, sampling.   |
| `viza-fe/internal-website/instrumentation.ts`                  | Next.js server + edge runtime init hook.                       |
| `viza-fe/internal-website/sentry.client.config.ts`             | Browser init (replaysOnErrorSampleRate=1).                     |
| `viza-be/agent-backend/src/observability/sentry-init.ts`       | Node SDK init called from `src/index.ts` before HTTP listen.   |
| `.github/workflows/sentry-release.yml`                         | Uploads sourcemaps + finalizes release on each main push.      |

All four files lazy-load `@sentry/nextjs` (FE) and `@sentry/node` (BE) so type-check passes when the SDK isn't installed in dev. The runtime is responsible for installing the dep on the deploy target.

## Human handoff

To activate Sentry against a real project:

1. Create two Sentry projects:
   - `viza-fe-internal-website` (platform=nextjs)
   - `viza-agent-backend` (platform=node)
2. Copy the DSNs into env (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`).
3. Install the SDK on the deploy target:
   ```bash
   cd viza-fe/internal-website && npm i @sentry/nextjs
   cd viza-be/agent-backend && npm i @sentry/node
   ```
4. Set `SENTRY_AUTH_TOKEN` (GitHub Actions secret) + `SENTRY_ORG` + `SENTRY_PROJECT` (Actions vars) so `.github/workflows/sentry-release.yml` uploads sourcemaps.
5. Trigger a synthetic error to verify symbolicated stack + release tag:
   ```ts
   // anywhere in the FE
   throw new Error("VIZA Sentry smoke test " + new Date().toISOString());
   ```

## Rotation

`SENTRY_AUTH_TOKEN` rotates quarterly per `docs/security/secret-rotation.md`. DSNs rotate only when the Sentry project itself rotates.

## Verification checklist

- [ ] Synthetic error visible in Sentry UI with release tag equal to the deploy SHA.
- [ ] Source map applied (stack shows TS file, not `chunk.js:1:9234`).
- [ ] Replay attached on FE errors.
- [ ] Performance tab shows traces at `tracesSampleRate=0.1`.

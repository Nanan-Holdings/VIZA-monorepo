# Agent Backend Deploy (Render) — CI-005

`viza-be/agent-backend` is a persistent Express + Socket.IO service (WebSocket
chat). Deployed on Render via `render.yaml`.

## render.yaml decisions (CI-005)

- **plan: starter** (was `free`). The free plan spins down on idle and severs
  the Socket.IO WebSocket; `starter` is always-on.
- **PORT: 8080** — matches the Dockerfile `EXPOSE/ENV`. The app listens on
  `process.env.PORT`, so render's value is authoritative; 8080 keeps it
  consistent with local Docker + the Cloud Run deploy.
- **healthCheckPath: /health**.
- Secrets (`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `CORS_ORIGINS`) are `sync: false` — set in the Render dashboard, never
  committed (rotation: `docs/security/secret-rotation-runbook.md`).

## Deploy

Push to `main` → Render auto-deploys (`npm install && npm run build`, `npm start`).
Verify: `curl https://<service>.onrender.com/health`.

# VIZA submission-service runner image (INFRA-001).
#
# Pins Playwright + Chromium via the official mcr.microsoft.com/playwright
# base image. The base image already ships with Chromium, Firefox, and
# WebKit + the right system fonts and X libs for headed runs in CI.
#
# Build:
#   docker build -f viza-be/submission-service/Dockerfile \
#     -t ghcr.io/<org>/viza-runner:$(git rev-parse --short HEAD) \
#     viza-be/submission-service
#
# Smoke (no live portal hit, just confirms Playwright + tsx start cleanly):
#   docker run --rm <image> npm run smoke:ceac

# Pinned Playwright base. Bump together with package.json @playwright/test.
FROM mcr.microsoft.com/playwright:v1.58.2-jammy AS build

ENV NODE_ENV=production \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# ---- build deps layer ----
COPY package.json package-lock.json* ./
# TypeScript is a dev dependency, but this build stage deliberately compiles
# the source before the smaller production runtime is assembled.
RUN npm ci --include=dev

# ---- src layer ----
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

RUN npm run build

FROM mcr.microsoft.com/playwright:v1.58.2-jammy AS runtime

ENV NODE_ENV=production \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# Vietnam and other live runners write only redacted diagnostic artifacts here.
# The runtime drops privileges to pwuser, so create the directory with the
# matching owner instead of relying on Docker's root-owned WORKDIR.
RUN install -d -o pwuser -g pwuser /app/diag-out

# Default user: keep playwright's pre-baked `pwuser` so chromium can sandbox.
USER pwuser

# Default command runs the worker loop. Override at `docker run` time for
# smoke tests:
#   docker run --rm <image> npx tsx src/ceac/_e2e.ts --headless
CMD ["node", "dist/index.js"]

#!/usr/bin/env bash
set -euo pipefail

# Required: FLY_API_TOKEN, FLY_ORG. Usage: deploy-legacy.sh <image>
image="${1:?immutable image reference is required}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
app="viza-submission-legacy"

fly apps create "$app" --org "$FLY_ORG" 2>/dev/null || fly status --app "$app" >/dev/null
"$root/scripts/fly/sync-runtime-secrets.sh" "$app"
fly deploy --app "$app" --config "$root/deploy/fly/fly.legacy.toml" --image "$image" --strategy immediate

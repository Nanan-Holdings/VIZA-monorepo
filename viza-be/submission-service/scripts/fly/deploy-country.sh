#!/usr/bin/env bash
set -euo pipefail

# Deploy one immutable image to a country-scoped, always-on Fly worker.
# Required: FLY_API_TOKEN, FLY_ORG.
# Usage: deploy-country.sh <country> <immutable-image|--remote-build>
country="${1:?country is required}"
deployment_source="${2:?immutable image reference or --remote-build is required}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
config="$root/deploy/fly/countries.json"

if ! jq -e --arg country "$country" '.countries | index($country)' "$config" >/dev/null; then
  echo "Unsupported Fly worker country: $country" >&2
  exit 2
fi

region="$(jq -r '.defaultRegion' "$config")"
# runner_job uses underscore country keys; Fly app names permit dashes only.
app="viza-runner-${country//_/-}"
tw_browserbase_enabled="false"
if [[ "$country" == "taiwan" ]]; then
  tw_browserbase_enabled="true"
fi
rendered="$(mktemp -t viza-fly-country)"
trap 'rm -f "$rendered"' EXIT
sed -e "s/__APP_NAME__/$app/g" -e "s/__COUNTRY__/$country/g" -e "s/__REGION__/$region/g" \
  -e "s/__TW_ENTRY_PERMIT_BROWSERBASE_ENABLED__/$tw_browserbase_enabled/g" \
  "$root/deploy/fly/fly.country.toml.template" > "$rendered"

if ! fly apps create "$app" --org "$FLY_ORG"; then
  # An existing app is normal on repeat deploys; any other create failure must
  # remain visible to the operator instead of being mistaken for an app lookup.
  fly status --app "$app" >/dev/null
fi
bash "$root/scripts/fly/sync-runtime-secrets.sh" "$app" "$country"
if [[ "$deployment_source" == "--remote-build" ]]; then
  fly deploy "$root" --app "$app" --config "$rendered" --remote-only --strategy immediate --yes
else
  fly_image="registry.fly.io/$app:${deployment_source##*:}"
  docker pull "$deployment_source"
  docker tag "$deployment_source" "$fly_image"
  docker push "$fly_image"
  fly deploy --app "$app" --config "$rendered" --image "$fly_image" --strategy immediate
fi
bash "$root/scripts/fly/verify-country-worker.sh" "$country"

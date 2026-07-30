#!/usr/bin/env bash
set -euo pipefail

# Deploy one immutable image to a country-scoped, always-on Fly worker.
# Required: FLY_API_TOKEN, FLY_ORG. Usage: deploy-country.sh <country> <image>
country="${1:?country is required}"
image="${2:?immutable image reference is required}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
config="$root/deploy/fly/countries.json"

if ! jq -e --arg country "$country" '.countries | index($country)' "$config" >/dev/null; then
  echo "Unsupported Fly worker country: $country" >&2
  exit 2
fi

region="$(jq -r '.defaultRegion' "$config")"
# runner_job uses underscore country keys; Fly app names permit dashes only.
app="viza-runner-${country//_/-}"
rendered="$(mktemp --suffix=.toml)"
trap 'rm -f "$rendered"' EXIT
sed -e "s/__APP_NAME__/$app/g" -e "s/__COUNTRY__/$country/g" -e "s/__REGION__/$region/g" \
  "$root/deploy/fly/fly.country.toml.template" > "$rendered"

# Vietnam Pre-Arrival is still produced through submission_queue. Keep its
# retained country worker on that transport until the frontend enqueue path and
# status UI migrate together; otherwise the machine starts successfully but
# never claims the applicant's job.
if [[ "$country" == "vietnam" ]]; then
  sed -i \
    -e 's/SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED = "false"/SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED = "true"/' \
    -e 's/SUBMISSION_SERVICE_RUNNER_JOB_CONSUMER_ENABLED = "true"/SUBMISSION_SERVICE_RUNNER_JOB_CONSUMER_ENABLED = "false"/' \
    "$rendered"
fi

if ! fly apps create "$app" --org "$FLY_ORG"; then
  # An existing app is normal on repeat deploys; any other create failure must
  # remain visible to the operator instead of being mistaken for an app lookup.
  fly status --app "$app" >/dev/null
fi
bash "$root/scripts/fly/sync-runtime-secrets.sh" "$app" "$country"
fly_image="registry.fly.io/$app:${image##*:}"
docker pull "$image"
docker tag "$image" "$fly_image"
docker push "$fly_image"
fly deploy --app "$app" --config "$rendered" --image "$fly_image" --strategy immediate
bash "$root/scripts/fly/verify-country-worker.sh" "$country"

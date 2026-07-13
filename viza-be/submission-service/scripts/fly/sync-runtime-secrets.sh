#!/usr/bin/env bash
set -euo pipefail

# Copies only boot-required runtime secrets from the protected CI environment
# into one Fly app. Values are never printed or written to disk.
app="${1:?Fly app name is required}"
required=(SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUBMISSION_RESULT_SECRET_KEY)
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing required runtime secret: $key" >&2
    exit 2
  fi
done

fly secrets set --app "$app" --detach \
  "SUPABASE_URL=$SUPABASE_URL" \
  "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY" \
  "SUBMISSION_RESULT_SECRET_KEY=$SUBMISSION_RESULT_SECRET_KEY"

# Capability secrets are optional: only inject a value when the protected CI
# environment actually provides it. This prevents an empty GitHub secret from
# overwriting an operator-managed Fly secret and keeps credentials out of the
# image, rendered Fly config, and logs.
optional=(
  MDAC_BROWSER_API_ENDPOINT
  MDAC_BRIGHTDATA_BROWSER_API_ENDPOINT
  TWOCAPTCHA_API_KEY
  RESEND_API_KEY
  RESEND_OPS_ALERT_TO
  SLACK_WEBHOOK_URL
)
for key in "${optional[@]}"; do
  if [[ -n "${!key:-}" ]]; then
    fly secrets set --app "$app" --detach "$key=${!key}"
  fi
done

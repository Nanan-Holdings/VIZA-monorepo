#!/usr/bin/env bash
set -euo pipefail

# Copies only boot-required runtime secrets from the protected CI environment
# into one Fly app. Values are never printed or written to disk.
app="${1:?Fly app name is required}"
country="${2:?country scope is required}"
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
  RESEND_API_KEY
  RESEND_OPS_ALERT_TO
  SLACK_WEBHOOK_URL
)
for key in "${optional[@]}"; do
  if [[ -n "${!key:-}" ]]; then
    fly secrets set --app "$app" --detach "$key=${!key}"
  fi
done

# Capability secrets are scoped to the worker that needs them. This mirrors
# the Malaysia deployment pattern: a country worker receives only the remote
# browser/CAPTCHA/email capabilities its official flow uses.
case "$country" in
  malaysia)
    capability=(MDAC_BROWSER_API_ENDPOINT MDAC_BRIGHTDATA_BROWSER_API_ENDPOINT BROWSERBASE_API_KEY)
    ;;
  thailand)
    capability=(TDAC_BROWSER_API_ENDPOINT TDAC_BRIGHTDATA_BROWSER_API_ENDPOINT BROWSERBASE_API_KEY TWOCAPTCHA_API_KEY)
    ;;
  singapore)
    capability=(SGAC_BROWSER_API_ENDPOINT BROWSERBASE_API_KEY TWOCAPTCHA_API_KEY)
    ;;
  indonesia)
    capability=(BROWSERBASE_API_KEY IMAP_HOST IMAP_PORT IMAP_EMAIL IMAP_PASSWORD)
    ;;
  vietnam)
    capability=(BROWSERBASE_API_KEY TWOCAPTCHA_API_KEY)
    ;;
  united_states)
    capability=(BROWSERBASE_API_KEY TWOCAPTCHA_API_KEY)
    ;;
  france)
    capability=(BROWSERBASE_API_KEY TWOCAPTCHA_API_KEY FV_EMAIL FV_PASSWORD)
    ;;
  legacy)
    capability=(MDAC_BROWSER_API_ENDPOINT MDAC_BRIGHTDATA_BROWSER_API_ENDPOINT TDAC_BROWSER_API_ENDPOINT BROWSERBASE_API_KEY TWOCAPTCHA_API_KEY IMAP_HOST IMAP_PORT IMAP_EMAIL IMAP_PASSWORD FV_EMAIL FV_PASSWORD)
    ;;
  *)
    capability=()
    ;;
esac

for key in "${capability[@]}"; do
  if [[ -n "${!key:-}" ]]; then
    fly secrets set --app "$app" --detach "$key=${!key}"
  fi
done

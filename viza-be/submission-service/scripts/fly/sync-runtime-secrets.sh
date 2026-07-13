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

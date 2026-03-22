#!/bin/bash
# Regenerates client_profiles.csv from the live database.
# Run via cron every 5 minutes to keep Vector enrichment up to date.
# New child profiles created in the app are automatically picked up on the next run.

set -euo pipefail

CSV_PATH="/var/www/ai/FamilyShield/infra/vector/client_profiles.csv"
TMP_PATH="${CSV_PATH}.tmp"

PGPASSWORD="Shield@2026#Secure" psql \
  -U shield \
  -d shield_db \
  -h 127.0.0.1 \
  -p 5432 \
  -t \
  -A \
  -F ',' \
  -c "SELECT p.dns_client_id, p.id::text, p.tenant_id::text
      FROM profile.child_profiles p
      WHERE p.dns_client_id IS NOT NULL
        AND p.dns_client_id != ''
      ORDER BY p.created_at;" \
  > "${TMP_PATH}"

# Only update if query succeeded and file is non-empty
if [ -s "${TMP_PATH}" ]; then
  echo "dns_client_id,profile_id,tenant_id" > "${CSV_PATH}"
  cat "${TMP_PATH}" >> "${CSV_PATH}"
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] client_profiles.csv refreshed ($(wc -l < "${TMP_PATH}") profiles)"
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] WARNING: empty result — keeping existing CSV"
fi

rm -f "${TMP_PATH}"

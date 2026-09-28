#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
backup_file="${1:-backups/nischit-$(date -u +%Y%m%dT%H%M%SZ).dump}"

umask 077
mkdir -p "$(dirname "$backup_file")"
pg_dump --format=custom --no-owner --no-privileges --file="$backup_file" "$DATABASE_URL"
printf 'PostgreSQL backup written to %s\n' "$backup_file"

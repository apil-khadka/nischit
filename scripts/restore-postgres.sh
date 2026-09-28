#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${RESTORE_FILE:?RESTORE_FILE must point to an explicit backup file}"
: "${CONFIRM_RESTORE:?Set CONFIRM_RESTORE=YES to allow a destructive restore}"

if [[ "$CONFIRM_RESTORE" != "YES" ]]; then
  printf 'Refusing restore: set CONFIRM_RESTORE=YES explicitly.\n' >&2
  exit 2
fi
if [[ ! -f "$RESTORE_FILE" ]]; then
  printf 'Restore file does not exist: %s\n' "$RESTORE_FILE" >&2
  exit 2
fi

pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$RESTORE_FILE"
printf 'PostgreSQL restore completed from %s\n' "$RESTORE_FILE"

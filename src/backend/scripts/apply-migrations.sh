#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql:///janus?host=/run/postgresql}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/../drizzle/0001_auth_tables.sql"
echo "✅ Applied auth migration: 0001_auth_tables.sql"

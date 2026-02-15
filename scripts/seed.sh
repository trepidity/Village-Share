#!/usr/bin/env bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

cd "$(dirname "$0")/.."

SEED_FILE="supabase/seed.sql"

if [ ! -f "$SEED_FILE" ]; then
  error "Seed file not found: $SEED_FILE"
  exit 1
fi

SUPABASE_CMD=""
if command -v supabase &>/dev/null; then
  SUPABASE_CMD="supabase"
elif npx supabase --version &>/dev/null 2>&1; then
  SUPABASE_CMD="npx supabase"
else
  error "Supabase CLI not found. Install: npm i -g supabase"
  exit 1
fi

# Check local Supabase is running
if ! $SUPABASE_CMD status &>/dev/null; then
  error "Local Supabase is not running. Start it with: npm run db:start"
  exit 1
fi
ok "Local Supabase is running"

# Extract DB URL from supabase status
DB_URL=$($SUPABASE_CMD status -o env 2>/dev/null | grep "DB_URL" | cut -d '=' -f2- || true)

if [ -n "$DB_URL" ] && command -v psql &>/dev/null; then
  info "Seeding database via psql..."
  psql "$DB_URL" -f "$SEED_FILE"
else
  info "Seeding database via supabase db execute..."
  $SUPABASE_CMD db execute --file "$SEED_FILE"
fi

ok "Seed data loaded successfully"

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

SUPABASE_CMD=""
if command -v supabase &>/dev/null; then
  SUPABASE_CMD="supabase"
elif npx supabase --version &>/dev/null 2>&1; then
  SUPABASE_CMD="npx supabase"
else
  error "Supabase CLI not found. Install: npm i -g supabase"
  exit 1
fi

TARGET="${1:-}"

if [ -z "$TARGET" ]; then
  echo "Usage: ./scripts/migrate.sh <local|remote>"
  echo ""
  echo "  local   Push migrations to local Supabase instance"
  echo "  remote  Push migrations to linked remote project"
  exit 1
fi

case "$TARGET" in
  local)
    info "Migration status (local):"
    $SUPABASE_CMD migration list || true
    echo ""

    info "Pushing migrations to local database..."
    $SUPABASE_CMD db push
    ok "Local migrations applied"

    echo ""
    info "Migration status (after):"
    $SUPABASE_CMD migration list || true
    ;;

  remote)
    info "Migration status (remote):"
    $SUPABASE_CMD migration list --linked || true
    echo ""

    warn "You are about to push migrations to the REMOTE database."
    warn "This will modify your production/staging database."
    info "Proceeding in 3 seconds... (Ctrl+C to cancel)"
    sleep 3

    info "Pushing migrations to remote database..."
    $SUPABASE_CMD db push --linked
    ok "Remote migrations applied"

    echo ""
    info "Migration status (after):"
    $SUPABASE_CMD migration list --linked || true
    ;;

  *)
    error "Unknown target: $TARGET"
    echo "Usage: ./scripts/migrate.sh <local|remote>"
    exit 1
    ;;
esac

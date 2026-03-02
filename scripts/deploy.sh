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

echo ""
info "VillageShare - Production Deployment"
echo "======================================"
echo ""

# Pre-flight checks
info "Running tests..."
npm test
ok "Tests passed"

info "Running linter..."
npm run lint
ok "Lint passed"

info "Type-checking..."
npx tsc --noEmit
ok "Type-check passed"

info "Building project..."
npm run build
ok "Build succeeded"

# Check Vercel CLI
if ! command -v vercel &>/dev/null; then
  error "Vercel CLI not found. Install: npm i -g vercel"
  exit 1
fi
ok "Vercel CLI found"

# Check required env vars are set in Vercel
info "Checking Vercel environment variables..."
REQUIRED_VARS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_PHONE_NUMBER
  TWILIO_VERIFY_SERVICE_SID
  GEMINI_API_KEY
  RESEND_API_KEY
  NEXT_PUBLIC_APP_URL
  CRON_SECRET
)

ENV_OUTPUT=$(vercel env ls 2>&1) || {
  error "Failed to list Vercel env vars. Are you logged in? Run: vercel login"
  exit 1
}

MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
  if echo "$ENV_OUTPUT" | grep -q "$var"; then
    ok "$var"
  else
    error "Missing: $var"
    MISSING=1
  fi
done

if [ "$MISSING" -eq 1 ]; then
  error "Missing environment variables in Vercel. Add them with: vercel env add <NAME>"
  exit 1
fi
ok "All environment variables configured"

# Run Supabase migrations
info "Applying Supabase migrations to remote database..."

SUPABASE_CMD=""
if command -v supabase &>/dev/null; then
  SUPABASE_CMD="supabase"
elif npx supabase --version &>/dev/null 2>&1; then
  SUPABASE_CMD="npx supabase"
else
  error "Supabase CLI not found. Install: npm i -g supabase"
  exit 1
fi

$SUPABASE_CMD db push --linked
ok "Migrations applied"

# Confirm before deploying
echo ""
warn "You are about to deploy to PRODUCTION."
read -rp "Continue? (y/N) " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  info "Deployment cancelled."
  exit 0
fi

# Deploy
echo ""
info "Deploying to production..."
vercel --prod
echo ""
ok "Deployment complete!"

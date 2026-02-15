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
info "VillageShare - Local Development Setup"
echo "======================================="
echo ""

# Check prerequisites
MISSING=0

if command -v node &>/dev/null; then
  ok "Node.js $(node -v)"
else
  error "Node.js not found. Install from https://nodejs.org"
  MISSING=1
fi

if command -v npm &>/dev/null; then
  ok "npm $(npm -v)"
else
  error "npm not found"
  MISSING=1
fi

if command -v npx &>/dev/null && npx supabase --version &>/dev/null 2>&1; then
  ok "Supabase CLI (via npx)"
elif command -v supabase &>/dev/null; then
  ok "Supabase CLI $(supabase --version)"
else
  warn "Supabase CLI not found. Install: npm i -g supabase or brew install supabase/tap/supabase"
  warn "Local Supabase will be skipped."
fi

DOCKER_AVAILABLE=0
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  ok "Docker is running"
  DOCKER_AVAILABLE=1
else
  warn "Docker not available. Local Supabase requires Docker."
fi

if [ "$MISSING" -eq 1 ]; then
  error "Missing required prerequisites. Aborting."
  exit 1
fi

# Copy .env.local.example if .env.local doesn't exist
if [ -f .env.local ]; then
  ok ".env.local already exists"
else
  if [ -f .env.local.example ]; then
    cp .env.local.example .env.local
    ok "Created .env.local from .env.local.example"
    warn "Edit .env.local with your actual credentials before running the app."
  else
    warn ".env.local.example not found - skipping env file setup"
  fi
fi

# Install dependencies
info "Installing dependencies..."
npm install
ok "Dependencies installed"

# Start local Supabase if Docker is available
if [ "$DOCKER_AVAILABLE" -eq 1 ]; then
  SUPABASE_CMD=""
  if command -v supabase &>/dev/null; then
    SUPABASE_CMD="supabase"
  elif npx supabase --version &>/dev/null 2>&1; then
    SUPABASE_CMD="npx supabase"
  fi

  if [ -n "$SUPABASE_CMD" ]; then
    info "Starting local Supabase..."
    $SUPABASE_CMD start || warn "Supabase start failed - it may already be running"

    info "Running migrations..."
    $SUPABASE_CMD db push || warn "Migration push failed - migrations may already be applied"
    ok "Local Supabase is ready"
  fi
else
  warn "Skipping local Supabase setup (Docker not available)"
fi

echo ""
ok "Setup complete! Run 'npm run dev' to start developing."
echo ""

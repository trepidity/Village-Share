# VillageShare

Community lending platform where friends and family organize into **villages**, create **shops** (lending libraries), and borrow/return items via SMS, web chat, or a dashboard UI.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 16 (App Router), TypeScript |
| Database + Auth | Supabase (PostgreSQL, Auth, Storage) |
| UI | Tailwind CSS 4, shadcn/ui |
| SMS | Twilio (messaging + Verify) |
| Email | Resend (transactional invites) |
| AI/NLP | compromise.js (rule-based) + Google Gemini Flash-Lite (fallback) |
| Testing | vitest |

## Prerequisites

- Node.js 18+
- Docker (for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

## Quick Start

```bash
# Clone and install
git clone <repo-url> && cd VillageShare
npm install

# Set up environment
cp .env.local.example .env.local
# Fill in your Supabase, Twilio, Gemini, and Resend credentials

# Start local Supabase and run migrations
npm run db:start
npm run migrate

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number (E.164 format) |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify service SID |
| `GEMINI_API_KEY` | Google Gemini API key |
| `RESEND_API_KEY` | Resend API key for invite emails |
| `NEXT_PUBLIC_APP_URL` | Public app URL (e.g. `http://localhost:3000`) |
| `CRON_SECRET` | Secret for cron endpoint authentication |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run setup` | Initial project setup |
| `npm run deploy` | Production deployment (tests + lint + type-check + build + Vercel) |
| `npm run migrate` | Run migrations locally |
| `npm run migrate:prod` | Run migrations on remote database |
| `npm run seed` | Seed the database |
| `npm run db:start` | Start local Supabase |
| `npm run db:stop` | Stop local Supabase |
| `npm run db:reset` | Reset local database |

## SMS Commands

Text any of these to your VillageShare Twilio number:

| Command | Example |
|---|---|
| **Borrow** | "borrow the drill", "can I get the mixer?" |
| **Return** | "return the mixer", "bring back the drill" |
| **Search** | "what's available?", "do you have a drill?" |
| **Reserve** | "reserve the trailer for next Saturday" |
| **Status** | "my borrows", "what do I have?" |
| **Who has** | "who has the drill?" |
| **Availability** | "is the drill available?" |
| **Add item** | "add drill" (shop owners only) |
| **Remove item** | "remove drill" (shop owners only) |
| **Help** | "help", "commands" |
| **Cancel** | "cancel my reservation for the drill" |

The parser supports natural language -- no need for exact command syntax. If the rule-based parser can't understand a message, it falls back to Gemini AI.

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, OAuth callback, phone setup
│   ├── (dashboard)/     # Dashboard, villages, shops, chat, borrows
│   ├── invite/          # Public invite acceptance
│   └── api/             # Chat, SMS webhook, cron, invites
├── lib/
│   ├── supabase/        # Client, server, admin, types
│   ├── twilio/          # SMS client, validation, sending
│   ├── email/           # Invite emails via Resend
│   ├── sms/             # Parser, router, templates, handlers
│   ├── ai/              # Gemini fallback provider
│   ├── invites/         # Invite acceptance logic
│   └── utils/           # Phone normalization, date formatting
└── components/          # Dashboard nav, shadcn/ui components
```

## Testing

```bash
npm test            # Run all 87 tests
npm run test:watch  # Watch mode
```

Tests cover the NLP parser, session/disambiguation state management, and chat API integration.

## Deployment

The deploy script handles the full production deployment pipeline:

```bash
npm run deploy
```

This runs: tests -> lint -> type-check -> build -> Supabase migrations -> Vercel production deploy.

Before deploying, ensure all environment variables are configured in Vercel (`vercel env add <NAME>`).

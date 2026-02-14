# VillageShare Implementation Plan

## Overview

SMS-first AI chatbot for community lending. Users create "shops" (lending libraries), add items, invite friends/family, and borrow/return items primarily via text message. A minimal web dashboard handles account setup, shop management, and item CRUD.

**Hosting target:** Free or near-free (Vercel free tier + Supabase free tier + Twilio pay-as-you-go ~$1-5/month).

---

## Tech Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend + API | Next.js 15+ (App Router) on Vercel | Free |
| Database + Auth + Storage | Supabase (PostgreSQL, Auth, Storage) | Free tier |
| SMS | Twilio ($1/mo number + ~$0.0079/msg) | ~$1-5/mo |
| AI/NLP | compromise.js (rule-based) + Google Gemini Flash-Lite fallback | Free |
| UI | Tailwind CSS + shadcn/ui | Free |
| Testing | vitest | Free |
| Forms | react-hook-form + zod | Free |

---

## Database Schema

12 migration files creating 10 tables + 1 storage bucket:

1. **Extensions** - Enable `pg_trgm` (fuzzy search) and `uuid-ossp`
2. **`profiles`** - Extends `auth.users` (id, display_name, phone, phone_verified, avatar_url). Auto-created via trigger on signup.
3. **`shops`** - Lending libraries (id, owner_id, name, description, is_active)
4. **`shop_members`** - Shop access (shop_id, user_id, role: owner/admin/member). Auto-created for owner via trigger.
5. **`shop_invites`** - Pending invitations by link token or phone (token, role, expires_at)
6. **`items`** - Lendable items (shop_id, name, description, category, photo_url, status). Trigram index on `name` for fuzzy SMS search.
7. **`borrows`** - Borrow tracking (item_id, borrower_id, from_shop_id, return_shop_id, status: requested/active/returned/cancelled, due_at)
8. **`reservations`** - Future holds (item_id, user_id, starts_at, ends_at, status: pending/confirmed/cancelled/fulfilled)
9. **`blackout_periods`** - Unavailability windows (shop_id, item_id nullable for whole-shop, starts_at, ends_at)
10. **`sms_sessions`** - Maps phone numbers to users, stores conversational context (active_shop_id, last_intent JSON)
11. **`notifications`** - Outbound SMS queue (user_id, channel, status, body, scheduled_at)
12. **Storage bucket** - `item-photos` for item photo uploads with public read access

**RLS:** All tables have Row Level Security. Web CRUD uses user JWTs. SMS/notification operations use the service role key server-side.

---

## Project Structure

```
VillageShare/
├── supabase/
│   ├── migrations/          # 12 SQL migration files
│   └── seed.sql
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx           # Google + Facebook OAuth
│   │   │   ├── callback/route.ts        # OAuth code exchange
│   │   │   └── setup-phone/page.tsx     # Phone verification after signup
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx               # Sidebar nav, auth guard
│   │   │   ├── page.tsx                 # Dashboard home
│   │   │   ├── shops/
│   │   │   │   ├── page.tsx             # Shop list
│   │   │   │   ├── new/page.tsx         # Create shop
│   │   │   │   └── [shopId]/
│   │   │   │       ├── page.tsx         # Shop detail with tabs
│   │   │   │       ├── items/page.tsx   # Item CRUD
│   │   │   │       ├── members/page.tsx # Member management + invites
│   │   │   │       └── settings/page.tsx# Shop settings + blackouts
│   │   │   ├── borrows/page.tsx         # My borrows across all shops
│   │   │   └── invite/[token]/page.tsx  # Accept invite
│   │   └── api/
│   │       ├── sms/webhook/route.ts     # Twilio inbound SMS
│   │       ├── sms/send/route.ts        # Phone verification
│   │       └── cron/notifications/route.ts  # Process notification queue
│   ├── lib/
│   │   ├── supabase/                    # client.ts, server.ts, admin.ts, types.ts
│   │   ├── twilio/                      # client.ts, validate.ts, send-sms.ts
│   │   ├── sms/
│   │   │   ├── parser.ts               # Rule-based NLP (compromise.js)
│   │   │   ├── router.ts               # Intent -> handler dispatch
│   │   │   ├── intents.ts              # Intent type definitions
│   │   │   ├── templates.ts            # SMS response templates
│   │   │   └── handlers/               # borrow, return, search, reserve, status, help, cancel
│   │   ├── ai/
│   │   │   ├── provider.ts             # Two-tier: rule-based first, LLM fallback
│   │   │   ├── gemini.ts               # Gemini REST API client (no SDK)
│   │   │   └── prompts.ts              # System prompts for command parsing
│   │   └── utils/                       # phone.ts, dates.ts
│   └── components/
│       ├── dashboard-nav.tsx            # Sidebar + mobile nav
│       └── ui/                          # shadcn/ui components
├── middleware.ts                         # Auth session refresh + phone verification redirect
├── tests/
│   └── parser.test.ts                   # 25 parser unit tests
├── vercel.json                          # Cron configuration
└── vitest.config.ts
```

---

## Authentication Flow

1. User visits web app -> signs in with Google or Facebook (Supabase Auth OAuth)
2. OAuth callback exchanges code for session, DB trigger creates `profiles` row
3. If `phone` is null, middleware redirects to `/setup-phone` for phone verification (Twilio Verify)
4. Phone verification creates `sms_sessions` row linking phone -> user_id
5. All subsequent SMS from that phone are authenticated via the session table
6. Unknown phone numbers get a registration link response

---

## SMS Webhook Flow

```
User SMS -> Twilio -> POST /api/sms/webhook
  1. Validate Twilio signature
  2. Look up sms_session by phone (admin client)
  3. If no session -> send registration link
  4. Parse message body (Tier 1: rule-based, Tier 2: Gemini fallback if confidence < 0.3)
  5. Check for pending disambiguation (last_intent.awaiting_choice)
  6. Route to intent handler
  7. Handler executes DB logic via admin client
  8. Persist last_intent state for multi-step flows
  9. Return TwiML <Message> response
```

---

## SMS Command Parsing (Two-Tier Architecture)

**Tier 1 - Rule-based (compromise.js):** Handles ~80-90% of messages at zero cost, sub-millisecond latency. Pattern-matches intents via regex, extracts entities (item names, shop names, dates) using compromise.js NLP. Confidence levels: 1.0 (exact keyword), 0.8 (regex match), 0.5 (loose match).

**Tier 2 - LLM fallback (Google Gemini Flash-Lite):** When rule-based confidence < 0.3, sends the message to Gemini with a structured JSON output prompt. Returns ParsedIntent with confidence 0.6. Free tier is limited, so this is a backstop.

**Supported intents:**

| Intent | Examples |
|---|---|
| BORROW | "borrow the drill", "can I get the mixer?", "checkout the table saw" |
| RETURN | "return the mixer", "bring back the drill", "I'm done with the hammer" |
| SEARCH | "what's available?", "do you have a drill?", "search for saw" |
| RESERVE | "reserve the trailer for next Saturday", "book the mixer for Friday" |
| STATUS | "my borrows", "what do I have?", "my stuff" |
| HELP | "help", "commands", "?" |
| CANCEL | "cancel my reservation for the drill" |

**Multi-step conversations:** `sms_sessions.last_intent` stores JSON state for disambiguation ("I found 2 drills: reply 1 or 2"). Number replies resolve pending choices.

---

## Notifications

- Vercel Cron (every 5 min) hits `GET /api/cron/notifications` (authenticated via CRON_SECRET)
- Processes pending notifications: looks up user phone, sends SMS, updates status
- Detects overdue borrows (due_at + 1 day) and creates reminder notifications
- Triggers throughout the app: borrow created -> owner notified, item returned -> owner notified

---

## Implementation Phases

### Phase 1: Foundation
- [x] Initialize Next.js + TypeScript + Tailwind + shadcn/ui
- [x] Install dependencies (supabase, twilio, compromise, react-hook-form, zod, vitest)
- [x] Create Supabase client libraries (browser, server, admin) with Database types
- [x] Create Twilio client, validation, and SMS utilities
- [x] Create utility libraries (phone normalization, date formatting)
- [x] Set up environment variable template

### Phase 2: Database
- [x] 12 SQL migration files with RLS policies
- [x] Auto-triggers for profile creation and owner membership
- [x] Trigram index on items for fuzzy search
- [x] Storage bucket for item photos

### Phase 3: Auth
- [x] Login page with Google + Facebook OAuth
- [x] OAuth callback route with session exchange
- [x] Phone verification page (send code / verify code via Twilio Verify)
- [x] Auth middleware (session refresh, phone verification redirect)

### Phase 4: Web Dashboard
- [x] Dashboard layout with responsive sidebar/mobile nav
- [x] Dashboard home (shops overview, recent activity, quick actions)
- [x] Shop list, create, and detail pages
- [x] Item CRUD with photo upload to Supabase Storage
- [x] Member management with invite link generation
- [x] Shop settings with blackout period management
- [x] Invite acceptance page (token lookup, expiry handling)
- [x] My Borrows page with return action

### Phase 5: SMS Pipeline
- [x] Intent type definitions (7 intents + UNKNOWN)
- [x] Rule-based NLP parser with compromise.js and compromise-dates
- [x] SMS response templates (17 templates, SMS-length optimized)
- [x] Intent router with disambiguation resolution and shop resolution
- [x] 7 handlers: help, search, borrow, return, status, reserve, cancel
- [x] Twilio webhook with signature validation and TwiML response
- [x] 25 parser unit tests

### Phase 6: AI Fallback
- [x] Gemini REST API client (direct fetch, no SDK dependency)
- [x] Structured JSON system prompt for intent parsing
- [x] Two-tier provider (rule-based first, Gemini when confidence < 0.3)

### Phase 7: Notifications
- [x] Cron endpoint with secret authentication
- [x] Pending notification processing (phone lookup, SMS send, status update)
- [x] Overdue borrow detection and reminder creation
- [x] Vercel cron configuration (every 5 minutes)

---

## Deployment Checklist

1. Create Supabase project and run all 12 migrations
2. Enable Google and Facebook OAuth providers in Supabase dashboard
3. Create Twilio account, buy a phone number, create a Verify service
4. Deploy to Vercel with environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_VERIFY_SERVICE_SID`
   - `GEMINI_API_KEY`
   - `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`
5. Configure Twilio webhook URL to `https://yourdomain.com/api/sms/webhook`
6. Update OAuth redirect URLs in Google/Facebook developer consoles

---

## Verification

1. **Auth:** Sign in with Google -> verify phone -> see dashboard
2. **Shop CRUD:** Create shop -> add items with photos -> invite a friend by phone
3. **SMS Borrow Flow:** Text "what's available?" -> get list -> "borrow the drill" -> confirm -> item status changes in web UI
4. **SMS Return Flow:** Text "return the drill" -> item status back to available
5. **Reservations:** Text "reserve the mixer for next saturday" -> reservation appears in web UI
6. **Notifications:** Borrow an item -> shop owner receives SMS notification
7. **AI Fallback:** Text something unusual like "yo can i snag that cake pan thing" -> Gemini parses it correctly
8. **Parser Tests:** `npm test` -> 25/25 passing

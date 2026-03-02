# VillageShare Implementation Plan

## Overview

SMS-first AI chatbot for community lending. Users create **villages** (groups of people), add **shops** (lending libraries) to a village, add items, invite friends/family, and borrow/return items primarily via text message or a web chat interface. A web dashboard handles account setup, village/shop management, and item CRUD.

**Hosting target:** Free or near-free (Vercel free tier + Supabase free tier + Twilio pay-as-you-go ~$1-5/month).

---

## Tech Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend + API | Next.js 16 (App Router) on Vercel | Free |
| Database + Auth + Storage | Supabase (PostgreSQL, Auth, Storage) | Free tier |
| SMS | Twilio ($1/mo number + ~$0.0079/msg) | ~$1-5/mo |
| AI/NLP | compromise.js (rule-based) + Google Gemini Flash-Lite fallback | Free |
| Email | Resend (transactional email for invites) | Free tier |
| UI | Tailwind CSS 4 + shadcn/ui | Free |
| Testing | vitest (87 tests) | Free |
| Forms | react-hook-form + zod | Free |

---

## Database Schema

19 migration files creating 13 tables + 1 storage bucket:

1. **Extensions** - Enable `pg_trgm` (fuzzy search) and `uuid-ossp`
2. **`profiles`** - Extends `auth.users` (id, display_name, phone, phone_verified, avatar_url). Auto-created via trigger on signup.
3. **`shops`** - Lending libraries (id, owner_id, name, short_name, description, village_id, is_active)
4. **`villages`** - Top-level organizational unit (id, name, description, created_by)
5. **`village_members`** - Village membership (village_id, user_id, role: owner/admin/member)
6. **`village_invites`** - Token-based invitations (token, village_id, role, email, expires_at, accepted_at)
7. **`items`** - Lendable items (shop_id, name, description, category, photo_url, status, location_shop_id). Trigram index on `name` for fuzzy SMS search.
8. **`borrows`** - Borrow tracking (item_id, borrower_id, from_shop_id, return_shop_id, status: requested/active/returned/cancelled, due_at)
9. **`reservations`** - Future holds (item_id, user_id, starts_at, ends_at, status: pending/confirmed/cancelled/fulfilled)
10. **`blackout_periods`** - Unavailability windows (shop_id, item_id nullable for whole-shop, starts_at, ends_at)
11. **`sms_sessions`** - Maps phone numbers to users, stores conversational context (active_shop_id, last_intent JSON)
12. **`notifications`** - Outbound SMS queue (user_id, channel, status, body, scheduled_at)
13. **`unrecognized_messages`** - Logs unparsed SMS/chat messages for analysis (user_id, phone, body, parsed_intent, confidence, source)
14. **Storage bucket** - `item-photos` for item photo uploads with public read access

**RLS:** All tables have Row Level Security. Web CRUD uses user JWTs. SMS/notification operations use the service role key server-side. RLS helpers: `is_village_member()`, `is_village_admin()`, `is_village_owner()`, `is_village_member_via_shop()`, `is_village_admin_via_shop()`.

**Dropped tables (migration 00017):** `shop_members`, `shop_invites`, `shop_role` enum — replaced by village-level membership.

---

## Project Structure

```
VillageShare/
├── supabase/
│   ├── migrations/          # 19 SQL migration files (00001–00019)
│   └── seed.sql
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx           # Google + Facebook OAuth
│   │   │   ├── callback/route.ts        # OAuth code exchange
│   │   │   ├── callback/[...redirect]/route.ts  # OAuth with redirect
│   │   │   └── setup-phone/page.tsx     # Phone verification after signup
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx               # Sidebar nav, auth guard
│   │   │   ├── page.tsx                 # Dashboard home
│   │   │   ├── chat/page.tsx            # AI chat interface
│   │   │   ├── villages/
│   │   │   │   ├── page.tsx             # Village list
│   │   │   │   ├── new/page.tsx         # Create village
│   │   │   │   └── [villageId]/
│   │   │   │       ├── page.tsx         # Village detail
│   │   │   │       ├── members/page.tsx # Village member management
│   │   │   │       └── settings/page.tsx# Village settings
│   │   │   ├── shops/
│   │   │   │   ├── page.tsx             # Shop list
│   │   │   │   ├── new/page.tsx         # Create shop
│   │   │   │   └── [shopId]/
│   │   │   │       ├── page.tsx         # Shop detail with tabs
│   │   │   │       ├── items/page.tsx   # Item CRUD
│   │   │   │       ├── members/page.tsx # Redirects to village members
│   │   │   │       └── settings/page.tsx# Shop settings + blackouts
│   │   │   ├── borrows/page.tsx         # My borrows across all shops
│   │   │   └── invite/[token]/page.tsx  # Accept invite (dashboard)
│   │   ├── invite/[token]/page.tsx      # Accept invite (public)
│   │   └── api/
│   │       ├── chat/route.ts            # AI chat endpoint
│   │       ├── sms/webhook/route.ts     # Twilio inbound SMS
│   │       ├── sms/send/route.ts        # Phone verification
│   │       ├── auth/phone-setup/route.ts# Phone verification API
│   │       ├── invites/send/route.ts    # Send invite emails
│   │       └── cron/notifications/route.ts  # Process notification queue
│   ├── lib/
│   │   ├── supabase/                    # client.ts, server.ts, admin.ts, types.ts
│   │   ├── twilio/                      # client.ts, validate.ts, send-sms.ts
│   │   ├── email/                       # send-invite.ts (Resend)
│   │   ├── invites/                     # accept.ts (invite acceptance logic)
│   │   ├── sms/
│   │   │   ├── parser.ts               # Rule-based NLP (compromise.js)
│   │   │   ├── router.ts               # Intent -> handler dispatch
│   │   │   ├── session.ts              # Disambiguation state management
│   │   │   ├── intents.ts              # Intent type definitions
│   │   │   ├── templates.ts            # SMS response templates
│   │   │   ├── invite-template.ts      # SMS invite template
│   │   │   ├── utils/resolve-shop.ts   # Shop resolution by name
│   │   │   └── handlers/               # borrow, return, search, reserve, status,
│   │   │                                # help, cancel, add-item, remove-item,
│   │   │                                # availability, who-has
│   │   ├── ai/
│   │   │   ├── provider.ts             # Two-tier: rule-based first, LLM fallback
│   │   │   ├── gemini.ts               # Gemini REST API client (no SDK)
│   │   │   └── prompts.ts              # System prompts for command parsing
│   │   └── utils/                       # phone.ts, dates.ts
│   └── components/
│       ├── dashboard-nav.tsx            # Sidebar + mobile nav
│       └── ui/                          # shadcn/ui components
├── middleware.ts                         # Auth session refresh + phone verification + village redirect
├── tests/
│   ├── parser.test.ts                   # Parser unit tests
│   ├── session.test.ts                  # Session/disambiguation tests
│   └── chat-api.test.ts                # Chat API tests
├── scripts/
│   ├── setup.sh                        # Local dev setup
│   ├── deploy.sh                       # Production deployment
│   ├── migrate.sh                      # Run migrations
│   └── seed.sh                         # Seed database
├── vercel.json                          # Cron configuration
└── vitest.config.ts
```

---

## Authentication Flow

1. User visits web app -> signs in with Google or Facebook (Supabase Auth OAuth)
2. OAuth callback exchanges code for session, DB trigger creates `profiles` row
3. If `phone` is null, middleware redirects to `/setup-phone` for phone verification (Twilio Verify)
4. Phone verification creates `sms_sessions` row linking phone -> user_id
5. If user has no village, middleware redirects to `/villages/new`
6. All subsequent SMS from that phone are authenticated via the session table
7. Unknown phone numbers get a registration link response

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
  9. Log unrecognized messages (confidence < 0.3) for analysis
  10. Return TwiML <Message> response
```

---

## Chat API Flow

```
User types in web chat -> POST /api/chat
  1. Authenticate via Supabase user JWT
  2. Parse message (Tier 1 rule-based, Tier 2 Gemini fallback)
  3. Route intent with user context (userId, activeShopId, lastIntent)
  4. Return reply + updated disambiguation state
```

---

## SMS Command Parsing (Two-Tier Architecture)

**Tier 1 - Rule-based (compromise.js):** Handles ~80-90% of messages at zero cost, sub-millisecond latency. Pattern-matches intents via regex, extracts entities (item names, shop names, dates) using compromise.js NLP. Confidence levels: 1.0 (exact keyword), 0.8 (regex match), 0.5 (loose match). Uses word-by-word fuzzy matching for item lookups.

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
| AVAILABILITY | "is the drill available?", "check the mixer" |
| WHO_HAS | "who has the drill?", "who borrowed the mixer?" |
| ADD_ITEM | "add drill", "add the cake pan" |
| REMOVE_ITEM | "remove drill", "delete the cake pan" |

**Multi-step conversations:** `sms_sessions.last_intent` stores JSON state for disambiguation ("I found 2 drills: reply 1 or 2"). Number replies and text-based replies resolve pending choices.

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
- [x] Install dependencies (supabase, twilio, compromise, react-hook-form, zod, vitest, resend)
- [x] Create Supabase client libraries (browser, server, admin) with Database types
- [x] Create Twilio client, validation, and SMS utilities
- [x] Create utility libraries (phone normalization, date formatting)
- [x] Set up environment variable template

### Phase 2: Database
- [x] 19 SQL migration files with RLS policies
- [x] Auto-triggers for profile creation and owner membership
- [x] Trigram index on items for fuzzy search
- [x] Storage bucket for item photos
- [x] Village model migration (villages, village_members, village_invites)
- [x] Unrecognized messages logging table

### Phase 3: Auth
- [x] Login page with Google + Facebook OAuth
- [x] OAuth callback route with session exchange
- [x] Phone verification page (send code / verify code via Twilio Verify)
- [x] Auth middleware (session refresh, phone verification redirect, village redirect)

### Phase 4: Web Dashboard
- [x] Dashboard layout with responsive sidebar/mobile nav
- [x] Dashboard home (shops overview, recent activity, quick actions)
- [x] Shop list, create, and detail pages
- [x] Item CRUD with photo upload to Supabase Storage
- [x] Shop settings with blackout period management
- [x] My Borrows page with return action
- [x] Village list, create, detail, members, and settings pages
- [x] Village invite flow (email invites via Resend, token-based acceptance)
- [x] AI chat interface (web-based chat with same NLP pipeline as SMS)

### Phase 5: SMS Pipeline
- [x] Intent type definitions (11 intents + UNKNOWN)
- [x] Rule-based NLP parser with compromise.js and compromise-dates
- [x] SMS response templates (SMS-length optimized)
- [x] Intent router with disambiguation resolution and shop resolution
- [x] 11 handlers: help, search, borrow, return, status, reserve, cancel, availability, who-has, add-item, remove-item
- [x] Twilio webhook with signature validation and TwiML response
- [x] Word-by-word fuzzy matching for item and shop lookups
- [x] Text-based disambiguation replies (not just number-based)
- [x] Unrecognized message logging for analysis

### Phase 6: AI Fallback
- [x] Gemini REST API client (direct fetch, no SDK dependency)
- [x] Structured JSON system prompt for intent parsing
- [x] Two-tier provider (rule-based first, Gemini when confidence < 0.3)

### Phase 7: Notifications
- [x] Cron endpoint with secret authentication
- [x] Pending notification processing (phone lookup, SMS send, status update)
- [x] Overdue borrow detection and reminder creation
- [x] Vercel cron configuration (every 5 minutes)

### Phase 8: Testing
- [x] Parser unit tests (comprehensive intent/entity extraction coverage)
- [x] Session/disambiguation state tests
- [x] Chat API integration tests
- [x] 87 tests total across 4 test files

---

## Deployment Checklist

1. Create Supabase project and run all 19 migrations
2. Enable Google and Facebook OAuth providers in Supabase dashboard
3. Create Twilio account, buy a phone number, create a Verify service
4. Create Resend account for transactional emails
5. Deploy to Vercel with environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_VERIFY_SERVICE_SID`
   - `GEMINI_API_KEY`
   - `RESEND_API_KEY`
   - `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`
6. Configure Twilio webhook URL to `https://yourdomain.com/api/sms/webhook`
7. Update OAuth redirect URLs in Google/Facebook developer consoles

---

## Verification

1. **Auth:** Sign in with Google -> verify phone -> see dashboard
2. **Villages:** Create village -> invite a friend by email -> they accept and join
3. **Shop CRUD:** Create shop in village -> add items with photos
4. **SMS Borrow Flow:** Text "what's available?" -> get list -> "borrow the drill" -> confirm -> item status changes in web UI
5. **SMS Return Flow:** Text "return the drill" -> item status back to available
6. **Chat:** Use web chat to borrow/return/search items
7. **Reservations:** Text "reserve the mixer for next saturday" -> reservation appears in web UI
8. **Notifications:** Borrow an item -> shop owner receives SMS notification
9. **AI Fallback:** Text something unusual like "yo can i snag that cake pan thing" -> Gemini parses it correctly
10. **Tests:** `npm test` -> 87/87 passing

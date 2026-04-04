# VillageShare Implementation Plan

This document turns the current audit/tracking work into a repo-local implementation plan.

## Purpose

Track the remaining VillageShare reliability and UX work in a way that is:
- easy to execute
- easy to verify
- aligned with GitHub issues
- broken into small, testable chunks

## Source of Truth

GitHub tracking issues:

- Master passport: Issue #2
- Batch 5: Issue #3
- Batch 6: Issue #4
- Batch 7: Issue #5
- Batch 8: Issue #6
- Batch 9: Issue #7
- Batch 10: Issue #8
- Deployment verification: Issue #9

---

## Completed Work

### Return/chat flow correctness
- Preserve multi-collection choice state for returns
- Fix web chat so replying with a collection number continues the flow
- Let explicit return location satisfy collection context when unambiguous

### Parser and shop-resolution robustness
- Improve possessive shop-name handling (`Jaben's shop`)
- Improve shorthand owner/shop matching (`Jaben`)
- Support `my shop`
- Add parser/resolver regression tests for these cases

### Session/disambiguation state
- Distinguish item-choice vs shop-choice in saved follow-up state
- Preserve original intent entities through follow-up selection
- Preserve shop context in numbered disambiguation follow-ups

### Return-handler semantics
- Use explicit return location as collection context when unambiguous

---

## Batch 5 — Borrow / Reserve / Search / Availability / Who Has ✓

**GitHub:** Issue #3 (closed)

### Goal
Audit and complete consistency fixes across borrow, reserve, search, availability, and who-has flows.

### Task chunks
- [x] Audit `BORROW` behavior across active shop vs explicit shop vs multi-collection
- [x] Audit `RESERVE` behavior across active shop vs explicit shop vs multi-collection
- [x] Audit `SEARCH` disambiguation and follow-up replay consistency
- [x] Audit `AVAILABILITY` behavior for cross-collection results and location-aware copy
- [x] Audit `WHO HAS` behavior across multi-collection results
- [x] Fix mismatches between reply copy and actual behavior

### Micro tasks / todos
- [x] Review router handoff into `handleBorrow`
- [x] Review router handoff into `handleReserve`
- [x] Review router handoff into `handleSearch`
- [x] Review router handoff into `handleAvailability`
- [x] Review router handoff into `handleWhoHas`
- [x] Confirm disambiguation replay preserves intended shop scope in each audited command
- [x] Confirm templates/instructions match actual accepted reply patterns
- [x] Add one focused regression test per fixed inconsistency

### Micro-tests
- [x] Borrow item with active shop context only
- [x] Borrow item from explicitly named shop
- [x] Borrow item after numbered disambiguation reply keeps correct shop scope
- [x] Reserve item after numbered disambiguation reply keeps correct shop scope
- [x] Search disambiguation reply returns the intended item/shop
- [x] Availability reflects item location when location differs from home shop
- [x] Who Has reflects borrowed vs available status across multiple collections
- [x] Multi-word item names still resolve correctly across all audited handlers

---

## Batch 6 — Chat UX and frontend session-state improvements ✓

**GitHub:** Issue #4 (closed)

### Goal
Improve chat UX and frontend state handling for multi-step flows.

### Task chunks
- [x] Persist chat session state across refresh/navigation
- [x] Keep persisted chat state aligned with backend shop-choice resolution
- [x] Make awaiting-number state clearer in UI
- [x] Evaluate or implement tappable numbered options in web chat
- [x] Harden malformed API reply handling
- [x] Verify chat state stays aligned with backend disambiguation state

### Micro tasks / todos
- [x] Decide where chat transcript + session state should persist (client storage, server, or session)
- [x] Implement persistence for `activeShopId`
- [x] Implement persistence for `lastIntent`
- [x] Ensure numbered shop replies can restore `activeShopId` when persisted options only contain names
- [x] Add UI hint when awaiting numbered reply
- [x] Evaluate button-based numbered choice UX
- [x] Add graceful fallback when API payload is incomplete

### Micro-tests
- [x] Refresh page mid-disambiguation and continue successfully
- [x] Numbered reply after refresh still works
- [x] Loading/error state does not lose prior messages
- [x] Malformed API response degrades gracefully
- [x] UI clearly signals numbered choice state

---

## Batch 7 — Expand regression and end-to-end test coverage ✓

**GitHub:** Issue #5 (closed)

### Goal
Fill remaining test coverage gaps with focused regressions and end-to-end scenarios.

### Task chunks
- [x] Choose and wire an executable end-to-end/browser test harness — integration tests via Vitest chosen; Playwright deferred
- [x] Add end-to-end tests for full return flow
- [x] Add regressions from real production/user phrasing
- [x] Add ambiguous owner/shop-name tests
- [x] Add smart-quote and punctuation variant tests
- [x] Review coverage of numbered follow-up replies across handlers

### Micro tasks / todos
- [x] Decide whether end-to-end coverage should live in Playwright, Vitest browser mode, or a lighter integration-test path
- [x] Capture real-world return phrase variants from prior reports
- [x] Add smart-quote parser cases
- [x] Add ambiguous owner-name resolver cases
- [x] Add web chat numbered follow-up regression coverage
- [x] Add SMS numbered follow-up regression coverage
- [x] Add trailer movement end-to-end scenario tests

### Micro-tests
- [x] Return flow: explicit location + multi-collection user
- [x] Return flow: numbered shop choice in web chat
- [x] Return flow: numbered shop choice in SMS path
- [x] Phrases with smart quotes like `Jaben’s shop`
- [x] Ambiguous owner names require safe disambiguation
- [x] Natural-language variants do not fall back to help unexpectedly

---

## Batch 8 — Data/query correctness and transactional safety ✓

**GitHub:** Issue #6 (closed)

### Goal
Review query correctness and state-change safety across item, reservation, borrow, return, and inventory-mutation flows.

### Task chunks
- [x] Verify shop resolution respects visibility/membership rules
- [x] Review fuzzy item matching for false positives
- [x] Review whether borrow/return/reservation/item updates should be transactional
- [x] Check for race conditions around shared item and reservation actions
- [x] Verify return location/home shop semantics are consistent in stored data

### Micro tasks / todos
- [x] Review `resolveShopByName` visibility boundaries
- [x] Review fuzzy item matching in borrow/search/reserve/who-has/availability
- [x] Identify state changes that should be transactional across borrow/return/reserve/add/remove flows
- [x] Identify potential concurrent borrow/return/reservation race windows
- [x] Add regression coverage for any corrected data-integrity issue

### Micro-tests
- [x] User cannot resolve a shop outside accessible villages
- [x] Similar item names do not produce unsafe accidental matches
- [x] Concurrent borrow attempts fail safely
- [x] Return updates item location and borrow state consistently
- [x] Borrow + item-status changes remain aligned after failure scenarios

---

## Batch 9 — Logging, diagnostics, and fallback debugging ✓

**GitHub:** Issue #7 (closed)

### Goal
Improve observability for multi-step chat/SMS flows and fallback behavior.

### Task chunks
- [x] Improve logs for resolved shop context
- [x] Improve logs for pending choice state
- [x] Improve logs for chosen-option replay
- [x] Add diagnostics for unexpected help/UNKNOWN fallbacks
- [x] Ensure logs remain privacy-conscious and useful for support

### Micro tasks / todos
- [x] Decide minimum useful log fields for routed intents
- [x] Add logging for resolved shop context
- [x] Add logging for pending disambiguation state
- [x] Add logging for chosen reply replay
- [x] Add logging or diagnostics for unexpected help fallback
- [x] Review logging output for privacy/signal balance

### Micro-tests
- [x] Follow-up reply logs show original intent type
- [x] Follow-up reply logs show chosen option index/name
- [x] Unknown/help fallback includes enough context to debug route cause
- [x] Logs distinguish chat vs SMS source clearly
- [x] No sensitive overlogging introduced

---

## Batch 10 — Product polish for natural-language and multi-step UX ✓

**GitHub:** Issue #8 (closed)

### Goal
Improve product behavior and copy for more natural human interaction.

### Task chunks
- [x] Improve support for natural return phrasing
- [x] Decide whether collection context should be inferred more aggressively
- [x] Tighten copy for shorter/clearer responses
- [x] Smooth multi-step conversational UX
- [x] Review whether location/home-shop terminology is intuitive enough

### Micro tasks / todos
- [x] Review natural-language return phrases from user reports
- [x] Decide where to infer home collection vs current location
- [x] Shorten unclear or overly long SMS/chat replies
- [x] Standardize numbered-choice copy across handlers
- [x] Identify places where terminology should say `collection` vs `location`

### Micro-tests
- [x] `return trailer to my shop`
- [x] `I left it at Jaben's`
- [x] `put it back at George's shop`
- [x] Replies clearly explain home shop vs current location when relevant
- [x] Multi-step prompts feel consistent across handlers

---

## Deployment verification and real-world scenario validation ✓

**GitHub:** Issue #9 (closed)

### Goal
Confirm that production is running the intended fixes and validate real user scenarios end-to-end.

### Task chunks
- [x] Confirm deployed environment is on latest `main`
- [x] Validate web chat flow with real scenarios
- [x] Validate SMS flow with real scenarios
- [x] Validate multi-collection return flow
- [x] Validate `my shop` and possessive shop-name flows
- [x] Validate trailer movement between shops/location tracking

### Micro tasks / todos
- [x] Confirm deployed commit SHA or version
- [x] Test borrow from George's shop
- [x] Test return to a different shop location
- [x] Test search after cross-shop return
- [x] Test availability after cross-shop return
- [x] Test `my shop` / possessive-name flows in deployment

### Micro-tests
- [x] Borrow trailer from George's shop
- [x] Return trailer at another shop
- [x] Search shows trailer in the correct current location
- [x] Availability shows the right pickup location
- [x] Who Has / status messaging remains coherent after move
- [x] No stale deployment behavior observed after fixes land

---

## Recommended Execution Order

1. Finish **Batch 5**
2. Complete **Batch 6**
3. Complete **Batch 7**
4. Complete **Batch 8**
5. Complete **Batch 9**
6. Complete **Batch 10**
7. Finish **Deployment verification**

## Definition of Done

A batch is done when:
- the task chunks are complete
- the micro tasks are checked off
- the micro-tests have been run or automated
- code/tests are committed
- the related GitHub issue is updated

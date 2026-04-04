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

## Batch 5 — Borrow / Reserve / Search / Availability / Who Has

**GitHub:** Issue #3

### Goal
Audit and complete consistency fixes across borrow, reserve, search, availability, and who-has flows.

### Task chunks
- [ ] Audit `BORROW` behavior across active shop vs explicit shop vs multi-collection
- [ ] Audit `RESERVE` behavior across active shop vs explicit shop vs multi-collection
- [ ] Audit `SEARCH` disambiguation and follow-up replay consistency
- [ ] Audit `AVAILABILITY` behavior for cross-collection results and location-aware copy
- [ ] Audit `WHO HAS` behavior across multi-collection results
- [ ] Fix mismatches between reply copy and actual behavior

### Micro tasks / todos
- [ ] Review router handoff into `handleBorrow`
- [ ] Review router handoff into `handleReserve`
- [ ] Review router handoff into `handleSearch`
- [ ] Review router handoff into `handleAvailability`
- [ ] Review router handoff into `handleWhoHas`
- [ ] Confirm disambiguation replay preserves intended shop scope in each audited command
- [ ] Confirm templates/instructions match actual accepted reply patterns
- [ ] Add one focused regression test per fixed inconsistency

### Micro-tests
- [ ] Borrow item with active shop context only
- [ ] Borrow item from explicitly named shop
- [ ] Borrow item after numbered disambiguation reply keeps correct shop scope
- [ ] Reserve item after numbered disambiguation reply keeps correct shop scope
- [ ] Search disambiguation reply returns the intended item/shop
- [ ] Availability reflects item location when location differs from home shop
- [ ] Who Has reflects borrowed vs available status across multiple collections
- [ ] Multi-word item names still resolve correctly across all audited handlers

---

## Batch 6 — Chat UX and frontend session-state improvements

**GitHub:** Issue #4

### Goal
Improve chat UX and frontend state handling for multi-step flows.

### Task chunks
- [ ] Persist chat session state across refresh/navigation
- [ ] Make awaiting-number state clearer in UI
- [ ] Evaluate or implement tappable numbered options in web chat
- [ ] Harden malformed API reply handling
- [ ] Verify chat state stays aligned with backend disambiguation state

### Micro tasks / todos
- [ ] Decide where chat session state should persist (client storage, server, or session)
- [ ] Implement persistence for `activeShopId`
- [ ] Implement persistence for `lastIntent`
- [ ] Add UI hint when awaiting numbered reply
- [ ] Evaluate button-based numbered choice UX
- [ ] Add graceful fallback when API payload is incomplete

### Micro-tests
- [ ] Refresh page mid-disambiguation and continue successfully
- [ ] Numbered reply after refresh still works
- [ ] Loading/error state does not lose prior messages
- [ ] Malformed API response degrades gracefully
- [ ] UI clearly signals numbered choice state

---

## Batch 7 — Expand regression and end-to-end test coverage

**GitHub:** Issue #5

### Goal
Fill remaining test coverage gaps with focused regressions and end-to-end scenarios.

### Task chunks
- [ ] Add end-to-end tests for full return flow
- [ ] Add regressions from real production/user phrasing
- [ ] Add ambiguous owner/shop-name tests
- [ ] Add smart-quote and punctuation variant tests
- [ ] Review coverage of numbered follow-up replies across handlers

### Micro tasks / todos
- [ ] Capture real-world return phrase variants from prior reports
- [ ] Add smart-quote parser cases
- [ ] Add ambiguous owner-name resolver cases
- [ ] Add web chat numbered follow-up regression coverage
- [ ] Add SMS numbered follow-up regression coverage
- [ ] Add trailer movement end-to-end scenario tests

### Micro-tests
- [ ] Return flow: explicit location + multi-collection user
- [ ] Return flow: numbered shop choice in web chat
- [ ] Return flow: numbered shop choice in SMS path
- [ ] Phrases with smart quotes like `Jaben’s shop`
- [ ] Ambiguous owner names require safe disambiguation
- [ ] Natural-language variants do not fall back to help unexpectedly

---

## Batch 8 — Data/query correctness and transactional safety

**GitHub:** Issue #6

### Goal
Review query correctness and state-change safety across item/borrow/return flows.

### Task chunks
- [ ] Verify shop resolution respects visibility/membership rules
- [ ] Review fuzzy item matching for false positives
- [ ] Review whether borrow/item updates should be transactional
- [ ] Check for race conditions around shared item actions
- [ ] Verify return location/home shop semantics are consistent in stored data

### Micro tasks / todos
- [ ] Review `resolveShopByName` visibility boundaries
- [ ] Review fuzzy item matching in borrow/search/reserve/who-has/availability
- [ ] Identify state changes that should be transactional
- [ ] Identify potential concurrent borrow/return race windows
- [ ] Add regression coverage for any corrected data-integrity issue

### Micro-tests
- [ ] User cannot resolve a shop outside accessible villages
- [ ] Similar item names do not produce unsafe accidental matches
- [ ] Concurrent borrow attempts fail safely
- [ ] Return updates item location and borrow state consistently
- [ ] Borrow + item-status changes remain aligned after failure scenarios

---

## Batch 9 — Logging, diagnostics, and fallback debugging

**GitHub:** Issue #7

### Goal
Improve observability for multi-step chat/SMS flows and fallback behavior.

### Task chunks
- [ ] Improve logs for resolved shop context
- [ ] Improve logs for pending choice state
- [ ] Improve logs for chosen-option replay
- [ ] Add diagnostics for unexpected help/UNKNOWN fallbacks
- [ ] Ensure logs remain privacy-conscious and useful for support

### Micro tasks / todos
- [ ] Decide minimum useful log fields for routed intents
- [ ] Add logging for resolved shop context
- [ ] Add logging for pending disambiguation state
- [ ] Add logging for chosen reply replay
- [ ] Add logging or diagnostics for unexpected help fallback
- [ ] Review logging output for privacy/signal balance

### Micro-tests
- [ ] Follow-up reply logs show original intent type
- [ ] Follow-up reply logs show chosen option index/name
- [ ] Unknown/help fallback includes enough context to debug route cause
- [ ] Logs distinguish chat vs SMS source clearly
- [ ] No sensitive overlogging introduced

---

## Batch 10 — Product polish for natural-language and multi-step UX

**GitHub:** Issue #8

### Goal
Improve product behavior and copy for more natural human interaction.

### Task chunks
- [ ] Improve support for natural return phrasing
- [ ] Decide whether collection context should be inferred more aggressively
- [ ] Tighten copy for shorter/clearer responses
- [ ] Smooth multi-step conversational UX
- [ ] Review whether location/home-shop terminology is intuitive enough

### Micro tasks / todos
- [ ] Review natural-language return phrases from user reports
- [ ] Decide where to infer home collection vs current location
- [ ] Shorten unclear or overly long SMS/chat replies
- [ ] Standardize numbered-choice copy across handlers
- [ ] Identify places where terminology should say `collection` vs `location`

### Micro-tests
- [ ] `return trailer to my shop`
- [ ] `I left it at Jaben's`
- [ ] `put it back at George's shop`
- [ ] Replies clearly explain home shop vs current location when relevant
- [ ] Multi-step prompts feel consistent across handlers

---

## Deployment verification and real-world scenario validation

**GitHub:** Issue #9

### Goal
Confirm that production is running the intended fixes and validate real user scenarios end-to-end.

### Task chunks
- [ ] Confirm deployed environment is on latest `main`
- [ ] Validate web chat flow with real scenarios
- [ ] Validate SMS flow with real scenarios
- [ ] Validate multi-collection return flow
- [ ] Validate `my shop` and possessive shop-name flows
- [ ] Validate trailer movement between shops/location tracking

### Micro tasks / todos
- [ ] Confirm deployed commit SHA or version
- [ ] Test borrow from George's shop
- [ ] Test return to a different shop location
- [ ] Test search after cross-shop return
- [ ] Test availability after cross-shop return
- [ ] Test `my shop` / possessive-name flows in deployment

### Micro-tests
- [ ] Borrow trailer from George's shop
- [ ] Return trailer at another shop
- [ ] Search shows trailer in the correct current location
- [ ] Availability shows the right pickup location
- [ ] Who Has / status messaging remains coherent after move
- [ ] No stale deployment behavior observed after fixes land

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

import nlp from 'compromise'
import dates from 'compromise-dates'
import type { ParsedIntent, IntentType } from './intents'

nlp.plugin(dates)

/**
 * Parse an incoming SMS message into a structured intent with entities.
 * Uses regex patterns for speed, falling back to compromise for entity extraction.
 */
export function parseMessage(message: string): ParsedIntent {
  const raw = message
  const text = message.trim()
  const lower = text.toLowerCase()

  // --- Disambiguation: bare number reply ---
  const numberMatch = text.match(/^\s*(\d{1,2})\s*$/)
  if (numberMatch) {
    return {
      type: 'UNKNOWN', // Handler will check session context to resolve
      confidence: 1.0,
      entities: { choiceIndex: parseInt(numberMatch[1], 10) },
      raw,
    }
  }

  // --- HELP ---
  if (matchHelp(lower)) {
    return { type: 'HELP', confidence: 1.0, entities: {}, raw }
  }

  // --- CANCEL ---
  const cancelResult = matchCancel(lower, text)
  if (cancelResult) {
    return { ...cancelResult, raw }
  }

  // --- STATUS ---
  if (matchStatus(lower)) {
    return { type: 'STATUS', confidence: 1.0, entities: {}, raw }
  }

  // --- RETURN ---
  const returnResult = matchReturn(lower, text)
  if (returnResult) {
    return { ...returnResult, raw }
  }

  // --- RESERVE ---
  const reserveResult = matchReserve(lower, text)
  if (reserveResult) {
    return { ...reserveResult, raw }
  }

  // --- BORROW ---
  const borrowResult = matchBorrow(lower, text)
  if (borrowResult) {
    return { ...borrowResult, raw }
  }

  // --- SEARCH ---
  const searchResult = matchSearch(lower, text)
  if (searchResult) {
    return { ...searchResult, raw }
  }

  // --- Fallback: loose possessive borrow ---
  // "i want daniel's drill", "i need mike's saw"
  const loosePossessive = lower.match(
    /(?:i need|can i (?:get|use|have)|i'd like|i want)\s+(?:to\s+(?:borrow|get|use|have)\s+)?(\w+)'s\s+(.+?)$/
  )
  if (loosePossessive) {
    return {
      type: 'BORROW',
      confidence: 0.5,
      entities: {
        shopName: cleanEntity(loosePossessive[1]),
        itemName: cleanEntity(loosePossessive[2]),
      },
      raw,
    }
  }

  // --- Fallback: loose borrow match ---
  // "the drill" or just an item-sounding phrase with "I need" / "can I get"
  const looseBorrow = lower.match(
    /(?:i need|can i (?:get|use|have)|i'd like|i want)\s+(?:the\s+|a\s+)?(.+?)(?:\s+from\s+(.+?)(?:'s?\s+shop)?)?$/
  )
  if (looseBorrow) {
    const entities: ParsedIntent['entities'] = {
      itemName: cleanEntity(looseBorrow[1]),
    }
    if (looseBorrow[2]) {
      entities.shopName = cleanEntity(looseBorrow[2])
    }
    return { type: 'BORROW', confidence: 0.5, entities, raw }
  }

  return { type: 'UNKNOWN', confidence: 0, entities: {}, raw }
}

// ---------------------------------------------------------------------------
// Intent matchers
// ---------------------------------------------------------------------------

function matchHelp(lower: string): boolean {
  const helpPatterns = [
    /^help$/,
    /^commands$/,
    /^menu$/,
    /^\?$/,
    /^how (?:does|do) (?:this|it) work/,
    /^what can (?:i|you) do/,
    /^what are the commands/,
    /^info$/,
  ]
  return helpPatterns.some((p) => p.test(lower))
}

function matchStatus(lower: string): boolean {
  const statusPatterns = [
    /^(?:my )?(?:borrows|loans|stuff|items|rentals|status)$/,
    /^what (?:do )?i have\??$/,
    /^what(?:'s| is) (?:out|checked out|borrowed)\??$/,
    /^my (?:active )?(?:borrows|loans|reservations|bookings)$/,
    /^status$/,
  ]
  return statusPatterns.some((p) => p.test(lower))
}

function matchCancel(
  lower: string,
  _original: string
): Omit<ParsedIntent, 'raw'> | null {
  const cancelExact = /^cancel(?:\s+(?:my\s+)?reservation)?$/
  if (cancelExact.test(lower)) {
    return { type: 'CANCEL', confidence: 1.0, entities: {} }
  }

  const cancelItem = lower.match(
    /^cancel\s+(?:my\s+)?(?:reservation|booking|borrow)?\s*(?:for\s+)?(?:the\s+)?(.+?)$/
  )
  if (cancelItem) {
    return {
      type: 'CANCEL',
      confidence: 0.8,
      entities: { itemName: cleanEntity(cancelItem[1]) },
    }
  }

  return null
}

function matchReturn(
  lower: string,
  original: string
): Omit<ParsedIntent, 'raw'> | null {
  const returnPatterns = [
    /^(?:return|bring back|give back|drop off|i'm done with|im done with|finished with)\s+(?:the\s+)?(.+?)(?:\s+to\s+(.+?)(?:'s?\s+shop)?)?$/,
  ]

  for (const pattern of returnPatterns) {
    const match = lower.match(pattern)
    if (match) {
      const entities: ParsedIntent['entities'] = {
        itemName: cleanEntity(match[1]),
      }
      if (match[2]) {
        entities.shopName = cleanEntity(match[2])
      }
      return { type: 'RETURN', confidence: 0.8, entities }
    }
  }

  // Exact keyword
  if (/^return$/.test(lower)) {
    return { type: 'RETURN', confidence: 1.0, entities: {} }
  }

  return null
}

function matchReserve(
  lower: string,
  original: string
): Omit<ParsedIntent, 'raw'> | null {
  const reservePattern = lower.match(
    /^(?:reserve|book|schedule|hold)\s+(?:the\s+)?(.+?)(?:\s+(?:for|on|from)\s+(.+))?$/
  )
  if (!reservePattern) return null

  const entities: ParsedIntent['entities'] = {
    itemName: cleanEntity(reservePattern[1]),
  }

  // Use compromise-dates to extract dates from the date portion
  if (reservePattern[2]) {
    const datePart = reservePattern[2]
    const dateEntities = extractDates(datePart)
    if (dateEntities.date) entities.date = dateEntities.date
    if (dateEntities.dateEnd) entities.dateEnd = dateEntities.dateEnd
  }

  return {
    type: 'RESERVE',
    confidence: entities.date ? 0.9 : 0.8,
    entities,
  }
}

function matchBorrow(
  lower: string,
  _original: string
): Omit<ParsedIntent, 'raw'> | null {
  // Possessive form: "borrow daniel's drill", "can i get mike's chainsaw"
  // Uses \w+ (single word) before 's to avoid matching article+noun like "the painter's tape"
  const possessivePatterns = [
    /^(?:borrow|checkout|check out|rent|grab|pick up)\s+(\w+)'s\s+(.+?)$/,
    /^(?:can i|could i|may i)\s+(?:borrow|get|use|have|rent)\s+(\w+)'s\s+(.+?)\??$/,
  ]

  for (const pattern of possessivePatterns) {
    const match = lower.match(pattern)
    if (match) {
      return {
        type: 'BORROW',
        confidence: 0.8,
        entities: {
          shopName: cleanEntity(match[1]),
          itemName: cleanEntity(match[2]),
        },
      }
    }
  }

  // "from" form: "borrow the drill from daniel"
  const borrowPatterns = [
    /^(?:borrow|checkout|check out|rent|grab|pick up)\s+(?:the\s+|a\s+)?(.+?)(?:\s+from\s+(.+?)(?:'s?\s+shop)?)?$/,
    /^(?:can i|could i|may i)\s+(?:borrow|get|use|have|rent)\s+(?:the\s+|a\s+)?(.+?)(?:\s+from\s+(.+?)(?:'s?\s+shop)?)?\??$/,
  ]

  for (const pattern of borrowPatterns) {
    const match = lower.match(pattern)
    if (match) {
      const entities: ParsedIntent['entities'] = {
        itemName: cleanEntity(match[1]),
      }
      if (match[2]) {
        entities.shopName = cleanEntity(match[2])
      }
      return { type: 'BORROW', confidence: 0.8, entities }
    }
  }

  // Exact keyword
  if (/^borrow$/.test(lower)) {
    return { type: 'BORROW', confidence: 1.0, entities: {} }
  }

  return null
}

function matchSearch(
  lower: string,
  _original: string
): Omit<ParsedIntent, 'raw'> | null {
  // Exact keywords
  if (
    /^(?:search|list|browse|available|inventory|what's available|whats available|what do you have|what is available)\??$/.test(
      lower
    )
  ) {
    return { type: 'SEARCH', confidence: 1.0, entities: {} }
  }

  // "list items", "list all"
  if (/^list\s+(?:all\s+)?items?$/.test(lower)) {
    return { type: 'SEARCH', confidence: 1.0, entities: {} }
  }

  const searchPatterns = [
    /^(?:search for|look for|looking for|find me|search|look|find)\s+(?:a\s+|the\s+)?(.+?)$/,
    /^(?:do you have|got|have|is there)\s+(?:a\s+|an\s+|the\s+)?(.+?)\??$/,
    /^(?:any)\s+(.+?)(?:\s+available)?\??$/,
  ]

  for (const pattern of searchPatterns) {
    const match = lower.match(pattern)
    if (match) {
      return {
        type: 'SEARCH',
        confidence: 0.8,
        entities: { itemName: cleanEntity(match[1]) },
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Entity helpers
// ---------------------------------------------------------------------------

/**
 * Clean up an extracted entity string: trim, remove trailing punctuation.
 */
function cleanEntity(value: string): string {
  return value
    .trim()
    .replace(/[?.!,]+$/, '')
    .trim()
}

/**
 * Extract date(s) from a text fragment using compromise-dates.
 * Returns ISO date strings for start and optional end.
 */
function extractDates(text: string): { date?: string; dateEnd?: string } {
  const doc = nlp(text) as ReturnType<typeof nlp> & {
    dates: (opts?: { format: string }) => {
      get: () => Array<{ start: string; end?: string }>
      json: () => Array<{ dates: { start: string; end?: string } }>
    }
  }

  try {
    const parsed = doc.dates({ format: 'iso' }).json()
    if (parsed.length > 0 && parsed[0].dates) {
      const result: { date?: string; dateEnd?: string } = {}
      if (parsed[0].dates.start) {
        result.date = parsed[0].dates.start
      }
      if (parsed[0].dates.end && parsed[0].dates.end !== parsed[0].dates.start) {
        result.dateEnd = parsed[0].dates.end
      }
      return result
    }
  } catch {
    // Compromise couldn't parse dates - that's fine, return empty
  }

  return {}
}

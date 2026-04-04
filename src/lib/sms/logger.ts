import type { ParsedIntent } from './intents'

interface ChatLogEntry {
  event: 'chat_command'
  timestamp: string
  source: 'chat' | 'sms'
  userId: string
  raw: string
  intent: string
  confidence: number
  aiFallbackUsed: boolean
  entities: Record<string, unknown>
  response: string
  durationMs: number
}

interface RouterLogEntry {
  event: 'router_trace'
  timestamp: string
  source: 'chat' | 'sms'
  userId: string
  stage:
    | 'shop_resolved'
    | 'pending_choice'
    | 'choice_replayed'
    | 'fallback_help'
  intent: string
  details: Record<string, unknown>
}

export function logChatEvent(
  source: 'chat' | 'sms',
  userId: string,
  intent: ParsedIntent,
  aiFallbackUsed: boolean,
  response: string,
  startTime: number,
): void {
  const entry: ChatLogEntry = {
    event: 'chat_command',
    timestamp: new Date().toISOString(),
    source,
    userId,
    raw: intent.raw,
    intent: intent.type,
    confidence: intent.confidence,
    aiFallbackUsed,
    entities: intent.entities,
    response,
    durationMs: Date.now() - startTime,
  }
  console.log(JSON.stringify(entry))
}

export function logRouterEvent(
  source: 'chat' | 'sms',
  userId: string,
  intent: string,
  stage: RouterLogEntry['stage'],
  details: Record<string, unknown>
): void {
  const entry: RouterLogEntry = {
    event: 'router_trace',
    timestamp: new Date().toISOString(),
    source,
    userId,
    stage,
    intent,
    details,
  }
  console.log(JSON.stringify(entry))
}

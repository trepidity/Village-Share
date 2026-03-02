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

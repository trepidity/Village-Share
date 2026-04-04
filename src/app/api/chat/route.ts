import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseMessage } from '@/lib/sms/parser'
import { routeIntent, type LastIntent } from '@/lib/sms/router'
import { buildLastIntentState } from '@/lib/sms/session'
import { templates } from '@/lib/sms/templates'
import { logChatEvent } from '@/lib/sms/logger'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { message, activeShopId, lastIntent } = (await request.json()) as {
    message: string
    activeShopId: string | null
    lastIntent: LastIntent | null
  }

  const trimmed = typeof message === 'string' ? message.trim() : ''
  if (!trimmed) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  try {
    const startTime = Date.now()
    let aiFallbackUsed = false

    // Parse the message through the NLP pipeline
    let intent = parseMessage(trimmed)

    // AI fallback for low-confidence parses
    if (intent.confidence < 0.3) {
      try {
        const { parseWithAI } = await import('@/lib/ai/provider')
        const aiIntent = await parseWithAI(trimmed)
        if (aiIntent && aiIntent.confidence > intent.confidence) {
          intent = aiIntent
          aiFallbackUsed = true
        }
      } catch {
        // AI fallback is optional
      }
    }

    // Look up the user's phone for the router context (some handlers use it)
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .single()

    // Route the intent
    const reply = await routeIntent(intent, {
      userId: user.id,
      phone: profile?.phone ?? '',
      activeShopId: activeShopId ?? null,
      lastIntent: lastIntent ?? null,
      source: 'chat',
    })

    logChatEvent('chat', user.id, intent, aiFallbackUsed, reply, startTime)

    // Compute updated disambiguation state
    const newLastIntent = buildLastIntentState(intent, reply, {
      shopId: activeShopId ?? null,
    })

    let nextActiveShopId = activeShopId ?? null
    if (
      lastIntent?.awaiting_choice?.choice_kind === 'shop' &&
      intent.entities.choiceIndex != null &&
      Array.isArray(lastIntent.awaiting_choice.options)
    ) {
      const chosenOption =
        lastIntent.awaiting_choice.options[intent.entities.choiceIndex - 1]
      nextActiveShopId = chosenOption?.id ?? nextActiveShopId
    }

    return NextResponse.json({
      reply,
      activeShopId: nextActiveShopId,
      lastIntent: newLastIntent,
    })
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({
      reply: templates.error(),
      activeShopId: activeShopId ?? null,
      lastIntent: null,
    })
  }
}

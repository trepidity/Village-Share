import { NextRequest } from 'next/server'
import { validateTwilioSignature } from '@/lib/twilio/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseMessage } from '@/lib/sms/parser'
import { routeIntent, type LastIntent } from '@/lib/sms/router'
import { buildLastIntentState } from '@/lib/sms/session'
import { templates } from '@/lib/sms/templates'
import { logChatEvent } from '@/lib/sms/logger'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://villageshare.app'

/**
 * Build a TwiML XML response containing a single <Message>.
 */
function twiml(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
  return new Response(xml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}

/**
 * Escape special XML characters to prevent injection in TwiML.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Twilio webhook handler for incoming SMS messages.
 *
 * Flow:
 * 1. Validate Twilio signature
 * 2. Extract phone number and message body
 * 3. Look up SMS session by phone
 * 4. Parse message into intent
 * 5. If low confidence, attempt AI fallback
 * 6. Route to handler
 * 7. Update session state
 * 8. Return TwiML response
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio
    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    const phone = params.From
    const body = params.Body?.trim()
    const signature = request.headers.get('x-twilio-signature') ?? ''

    // Validate Twilio signature
    const webhookUrl =
      process.env.TWILIO_WEBHOOK_URL ??
      `${APP_URL}/api/sms/webhook`

    if (!validateTwilioSignature(webhookUrl, params, signature)) {
      return new Response('Forbidden', { status: 403 })
    }

    if (!phone || !body) {
      return twiml(templates.error())
    }

    const startTime = Date.now()
    let aiFallbackUsed = false

    const supabase = createAdminClient()

    // Look up SMS session by phone number
    const { data: session, error: sessionError } = await supabase
      .from('sms_sessions')
      .select('id, user_id, active_shop_id, last_intent')
      .eq('phone', phone)
      .single()

    if (sessionError || !session) {
      // No session found - unregistered user
      return twiml(templates.unknownUser(APP_URL))
    }

    // Parse the incoming message
    let intent = parseMessage(body)

    // If confidence is low, attempt AI fallback
    if (intent.confidence < 0.3) {
      try {
        const { parseWithAI } = await import('@/lib/ai/provider')
        const aiIntent = await parseWithAI(body)
        if (aiIntent && aiIntent.confidence > intent.confidence) {
          intent = aiIntent
          aiFallbackUsed = true
        }
      } catch (aiError) {
        // AI fallback is optional - proceed with original parse
        console.error('AI fallback error:', aiError)
      }
    }

    // Route the intent to the appropriate handler
    const responseText = await routeIntent(intent, {
      userId: session.user_id,
      phone,
      activeShopId: session.active_shop_id,
      lastIntent: session.last_intent as LastIntent | null,
      source: 'sms',
    })

    logChatEvent('sms', session.user_id, intent, aiFallbackUsed, responseText, startTime)

    // Build last_intent state for session persistence
    // If the response contains disambiguation options, store them
    const lastIntentState = buildLastIntentState(intent, responseText)

    // Update session: last_active_at and last_intent
    await supabase
      .from('sms_sessions')
      .update({
        last_active_at: new Date().toISOString(),
        last_intent: lastIntentState,
      })
      .eq('id', session.id)

    return twiml(responseText)
  } catch (err) {
    console.error('SMS webhook error:', err)
    return twiml(templates.error())
  }
}


import { getTwilioClient } from './client'

export async function sendSms(to: string, body: string) {
  const client = getTwilioClient()
  const start = Date.now()

  try {
    const message = await client.messages.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER!,
      body,
    })

    console.log(JSON.stringify({
      event: 'sms_send',
      timestamp: new Date().toISOString(),
      to,
      bodyLength: body.length,
      durationMs: Date.now() - start,
      ok: true,
      sid: message.sid,
    }))

    return message
  } catch (err) {
    console.log(JSON.stringify({
      event: 'sms_send',
      timestamp: new Date().toISOString(),
      to,
      bodyLength: body.length,
      durationMs: Date.now() - start,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }))
    throw err
  }
}

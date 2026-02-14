import { getTwilioClient } from './client'

export async function sendSms(to: string, body: string) {
  const client = getTwilioClient()
  return client.messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body,
  })
}

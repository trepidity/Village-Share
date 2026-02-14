import twilio from 'twilio'

export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  return twilio.validateRequest(authToken, signature, url, params)
}

import twilio from 'twilio'

let twilioClient: ReturnType<typeof twilio> | null = null

export function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )
  }
  return twilioClient
}

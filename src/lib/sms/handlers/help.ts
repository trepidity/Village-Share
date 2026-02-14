import { templates } from '@/lib/sms/templates'

/**
 * Handle the HELP intent - return the list of available commands.
 */
export async function handleHelp(): Promise<string> {
  return templates.help()
}

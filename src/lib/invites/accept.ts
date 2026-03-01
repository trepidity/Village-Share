import { createAdminClient } from '@/lib/supabase/admin'
import { debugLog } from '@/lib/debug-log'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type AdminClient = SupabaseClient<Database>

interface AcceptResult {
  success: boolean
  villageId?: string
  error?: string
}

/**
 * Accept a village invite on behalf of a user.
 *
 * Uses the admin client to bypass RLS — the village_members INSERT policy
 * only allows existing admins, but an invitee is not yet a member.
 */
export async function acceptVillageInvite(
  token: string,
  userId: string,
  adminClient?: AdminClient
): Promise<AcceptResult> {
  debugLog("ACCEPT", `Starting acceptVillageInvite: token=${token}, userId=${userId}, usingAdminClient=${!adminClient ? 'default' : 'provided'}`)
  const supabase = adminClient ?? createAdminClient()

  // Fetch valid invite
  const now = new Date().toISOString()
  debugLog("ACCEPT", `Querying invite: token=${token}, accepted_at=null, expires_at > ${now}`)
  const { data: invite, error: inviteError } = await supabase
    .from('village_invites')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', now)
    .single()

  debugLog("ACCEPT", `Invite query result: found=${!!invite}, error=${inviteError?.message ?? 'none'}${invite ? `, village_id=${invite.village_id}, role=${invite.role}, expires_at=${invite.expires_at}` : ''}`)

  if (inviteError || !invite) {
    debugLog("ACCEPT", `-> FAILED: invite not found or expired`)
    return { success: false, error: 'Invite not found or expired' }
  }

  // Check if already a member
  const { data: existingMember, error: memberCheckError } = await supabase
    .from('village_members')
    .select('id')
    .eq('village_id', invite.village_id)
    .eq('user_id', userId)
    .single()

  debugLog("ACCEPT", `Existing member check: found=${!!existingMember}, error=${memberCheckError?.message ?? 'none'}`)

  if (!existingMember) {
    debugLog("ACCEPT", `Inserting village member: village_id=${invite.village_id}, user_id=${userId}, role=${invite.role}`)
    const { error: insertError } = await supabase
      .from('village_members')
      .insert({
        village_id: invite.village_id,
        user_id: userId,
        role: invite.role,
      })

    if (insertError) {
      debugLog("ACCEPT", `-> FAILED to insert village member: ${JSON.stringify(insertError)}`)
      return { success: false, error: 'Failed to join village' }
    }
    debugLog("ACCEPT", `Successfully inserted village member`)
  } else {
    debugLog("ACCEPT", `User already a member, skipping insert`)
  }

  // Mark invite as accepted
  const { error: updateError } = await supabase
    .from('village_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  if (updateError) {
    debugLog("ACCEPT", `Failed to mark invite as accepted: ${JSON.stringify(updateError)}`)
  } else {
    debugLog("ACCEPT", `Marked invite as accepted`)
  }

  debugLog("ACCEPT", `-> SUCCESS: villageId=${invite.village_id}`)
  return { success: true, villageId: invite.village_id }
}

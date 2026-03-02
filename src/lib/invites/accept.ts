import { createAdminClient } from '@/lib/supabase/admin'
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
  const supabase = adminClient ?? createAdminClient()

  // Fetch valid invite (reusable — anyone with the link can join until it expires)
  const { data: invite, error: inviteError } = await supabase
    .from('village_invites')
    .select('*')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (inviteError || !invite) {
    return { success: false, error: 'Invite not found or expired' }
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('village_members')
    .select('id')
    .eq('village_id', invite.village_id)
    .eq('user_id', userId)
    .single()

  if (!existingMember) {
    const { error: insertError } = await supabase
      .from('village_members')
      .insert({
        village_id: invite.village_id,
        user_id: userId,
        role: invite.role,
      })

    if (insertError) {
      return { success: false, error: 'Failed to join village' }
    }
  }

  return { success: true, villageId: invite.village_id }
}

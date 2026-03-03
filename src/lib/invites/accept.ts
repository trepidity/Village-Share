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

  // Look up village by its static invite token
  const { data: village, error: villageError } = await supabase
    .from('villages')
    .select('id')
    .eq('invite_token', token)
    .single()

  if (villageError || !village) {
    return { success: false, error: 'Invite not found' }
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('village_members')
    .select('id')
    .eq('village_id', village.id)
    .eq('user_id', userId)
    .single()

  if (!existingMember) {
    const { error: insertError } = await supabase
      .from('village_members')
      .insert({
        village_id: village.id,
        user_id: userId,
        role: 'member',
      })

    if (insertError) {
      return { success: false, error: 'Failed to join village' }
    }
  }

  return { success: true, villageId: village.id }
}

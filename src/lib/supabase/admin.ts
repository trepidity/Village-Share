import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Admin client uses service role key - only use server-side
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

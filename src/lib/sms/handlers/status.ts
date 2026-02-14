import { createAdminClient } from '@/lib/supabase/admin'
import { templates } from '@/lib/sms/templates'

interface StatusContext {
  userId: string
}

/**
 * Handle the STATUS intent.
 * Fetch all active borrows for the user with item names and due dates.
 */
export async function handleStatus(context: StatusContext): Promise<string> {
  try {
    const supabase = createAdminClient()

    const { data: borrows, error } = await supabase
      .from('borrows')
      .select('id, due_at, borrowed_at, items!inner(name)')
      .eq('borrower_id', context.userId)
      .eq('status', 'active')
      .order('due_at', { ascending: true })

    if (error) {
      console.error('Status lookup error:', error)
      return templates.error()
    }

    if (!borrows || borrows.length === 0) {
      return templates.noBorrows()
    }

    const borrowList = borrows.map((b) => {
      const item = b.items as unknown as { name: string }
      return {
        itemName: item.name,
        dueAt: b.due_at ?? undefined,
      }
    })

    return templates.statusList(borrowList)
  } catch (err) {
    console.error('Status handler error:', err)
    return templates.error()
  }
}

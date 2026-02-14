import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio/send-sms'

/**
 * Cron endpoint to process the notification queue.
 * Vercel Cron triggers this via GET every 5 minutes.
 *
 * 1. Fetch pending notifications where scheduled_at <= now(), limit 50
 * 2. For each, look up the user's phone and send SMS
 * 3. Mark as 'sent' or 'failed'
 * 4. Check for overdue borrows and queue reminder notifications
 */
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  let processed = 0
  let failed = 0
  let overdueCreated = 0

  try {
    // ----------------------------------------------------------------
    // Step 1: Process pending notifications
    // ----------------------------------------------------------------
    const { data: notifications, error: fetchError } = await supabase
      .from('notifications')
      .select('id, user_id, body, channel')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(50)

    if (fetchError) {
      console.error('Failed to fetch notifications:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      )
    }

    for (const notification of notifications ?? []) {
      try {
        // Look up the user's phone number from profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', notification.user_id)
          .single()

        if (!profile?.phone) {
          // No phone on file -- mark as failed
          await supabase
            .from('notifications')
            .update({
              status: 'failed',
              error: 'No phone number on profile',
            })
            .eq('id', notification.id)

          failed++
          continue
        }

        // Send SMS
        await sendSms(profile.phone, notification.body)

        // Mark notification as sent
        await supabase
          .from('notifications')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', notification.id)

        processed++
      } catch (err) {
        console.error(
          `Failed to send notification ${notification.id}:`,
          err
        )

        // Mark as failed with error message
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown send error'

        await supabase
          .from('notifications')
          .update({
            status: 'failed',
            error: errorMessage,
          })
          .eq('id', notification.id)

        failed++
      }
    }

    // ----------------------------------------------------------------
    // Step 2: Check for overdue borrows and create reminder notifications
    // ----------------------------------------------------------------
    // Find active borrows where due_at < now() - 1 day (overdue by at least 1 day)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: overdueBorrows, error: overdueError } = await supabase
      .from('borrows')
      .select('id, borrower_id, due_at, item_id, from_shop_id, items(name), shops:from_shop_id(name)')
      .eq('status', 'active')
      .lt('due_at', oneDayAgo)

    if (overdueError) {
      console.error('Failed to fetch overdue borrows:', overdueError)
    }

    for (const borrow of overdueBorrows ?? []) {
      // Check if we already sent an overdue notification for this borrow
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', borrow.borrower_id)
        .like('body', `%overdue%`)
        .eq('metadata->borrow_id' as never, borrow.id)
        .limit(1)

      // Fallback: check by body content matching the borrow item name
      if (existingNotification && existingNotification.length > 0) {
        continue
      }

      // Also do a broader check -- look for any overdue notification
      // for this user mentioning this specific borrow ID in metadata
      const { data: broadCheck } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', borrow.borrower_id)
        .like('body', `%overdue%${(borrow.items as unknown as { name: string })?.name ?? ''}%`)
        .limit(1)

      if (broadCheck && broadCheck.length > 0) {
        continue
      }

      const itemName =
        (borrow.items as unknown as { name: string })?.name ?? 'an item'
      const shopName =
        (borrow.shops as unknown as { name: string })?.name ?? 'your shop'
      const dueDate = borrow.due_at
        ? new Date(borrow.due_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        : 'recently'

      const body = `Reminder: Your borrow of "${itemName}" from ${shopName} is overdue (was due ${dueDate}). Please return it soon or text RETURN ${itemName}.`

      const { error: insertError } = await supabase
        .from('notifications')
        .insert({
          user_id: borrow.borrower_id,
          channel: 'sms',
          body,
          metadata: { borrow_id: borrow.id, type: 'overdue_reminder' },
        })

      if (!insertError) {
        overdueCreated++
      } else {
        console.error('Failed to create overdue notification:', insertError)
      }
    }

    return NextResponse.json({
      ok: true,
      processed,
      failed,
      overdue_reminders_created: overdueCreated,
    })
  } catch (err) {
    console.error('Cron notifications error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

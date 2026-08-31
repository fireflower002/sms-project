import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rateLimit'

const clearChatSchema = z.object({
  mode: z.enum(['my_messages', 'all_messages', 'single'], {
    message: 'Invalid clear mode. Must be my_messages, all_messages, or single',
  }),
  messageId: z.string().uuid('Invalid message ID format').optional(),
}).refine(data => {
  if (data.mode === 'single') return !!data.messageId
  return true
}, {
  message: 'messageId is required for single message deletion',
})

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request)
    const rateLimit = checkRateLimit(clientIp, '/api/chat/clear', {
      windowMs: 60 * 1000,
      maxRequests: 5,
    })
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetInMs)
    }

    const body = await request.json().catch(() => ({}))
    const parseResult = clearChatSchema.safeParse(body)

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid chat clear payload'
      return NextResponse.json({ success: false, error: firstError }, { status: 400 })
    }

    const { mode, messageId } = parseResult.data

    // 1. Verify caller session
    const serverSupabase = await createServerClient()
    const { data: { user }, error: authErr } = await serverSupabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: No active session' }, { status: 401 })
    }

    // 2. Fetch user profile role
    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role || 'teacher'

    // 3. Setup Admin DB Client for guaranteed execution
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const dbClient = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : serverSupabase

    if (mode === 'single') {
      if (!messageId) {
        return NextResponse.json({ success: false, error: 'messageId is required for single deletion' }, { status: 400 })
      }

      // Layer 1 (Pre-Check Authorization): Check message existence & sender ownership for non-admins
      if (userRole !== 'admin') {
        const { data: msg } = await dbClient.from('hive_messages').select('sender_id').eq('id', messageId).maybeSingle()
        if (!msg || msg.sender_id !== user.id) {
          return NextResponse.json({ success: false, error: 'Forbidden: Cannot delete message owned by another user' }, { status: 403 })
        }
      }

      // Layer 2 (Query Filter Backstop): Append .eq('sender_id', user.id) filter for non-admins
      let deleteQuery = dbClient.from('hive_messages').delete().eq('id', messageId)
      if (userRole !== 'admin') {
        deleteQuery = deleteQuery.eq('sender_id', user.id)
      }

      const { error: delErr } = await deleteQuery

      if (delErr) {
        return NextResponse.json({ success: false, error: delErr.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, data: { mode: 'single', count: 1 } })
    }

    if (mode === 'my_messages') {
      const { error: delErr, count } = await dbClient
        .from('hive_messages')
        .delete({ count: 'exact' })
        .eq('sender_id', user.id)

      if (delErr) {
        return NextResponse.json({ success: false, error: delErr.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, data: { mode: 'my_messages', count: count || 0 } })
    }

    if (mode === 'all_messages') {
      if (userRole !== 'admin') {
        return NextResponse.json({ success: false, error: 'Forbidden: Admin access required to clear entire channel' }, { status: 403 })
      }

      const { error: delErr, count } = await dbClient
        .from('hive_messages')
        .delete({ count: 'exact' })
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (delErr) {
        return NextResponse.json({ success: false, error: delErr.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, data: { mode: 'all_messages', count: count || 0 } })
    }

    return NextResponse.json({ success: false, error: 'Invalid clear mode' }, { status: 400 })
  } catch (err: unknown) {
    console.error('[API /api/chat/clear] Error:', err)
    const message = err instanceof Error ? err.message : 'Server error clearing chat'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

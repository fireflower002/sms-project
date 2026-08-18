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
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { mode, messageId } = parseResult.data

    // 1. Verify caller session
    const serverSupabase = await createServerClient()
    const { data: { user }, error: authErr } = await serverSupabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized: No active session' }, { status: 401 })
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
        return NextResponse.json({ error: 'messageId is required for single deletion' }, { status: 400 })
      }
      // Check ownership or admin
      if (userRole !== 'admin') {
        const { data: msg } = await dbClient.from('hive_messages').select('sender_id').eq('id', messageId).maybeSingle()
        if (msg && msg.sender_id !== user.id) {
          return NextResponse.json({ error: 'Forbidden: Cannot delete other user message' }, { status: 403 })
        }
      }

      const { error: delErr } = await dbClient
        .from('hive_messages')
        .delete()
        .eq('id', messageId)

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, mode: 'single' })
    }

    if (mode === 'my_messages') {
      const { data: deleted, error: delErr } = await dbClient
        .from('hive_messages')
        .delete()
        .eq('sender_id', user.id)
        .select('id')

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, mode: 'my_messages', count: deleted?.length || 0 })
    }

    if (mode === 'all_messages') {
      if (userRole !== 'admin') {
        return NextResponse.json({ error: 'Forbidden: Admin access required to clear entire channel' }, { status: 403 })
      }

      const { data: deleted, error: delErr } = await dbClient
        .from('hive_messages')
        .delete()
        .gte('created_at', '1970-01-01T00:00:00Z')
        .select('id')

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, mode: 'all_messages', count: deleted?.length || 0 })
    }

    return NextResponse.json({ error: 'Invalid clear mode' }, { status: 400 })
  } catch (err: any) {
    console.error('[API /api/chat/clear] Error:', err)
    return NextResponse.json({ error: err?.message || 'Server error clearing chat' }, { status: 500 })
  }
}

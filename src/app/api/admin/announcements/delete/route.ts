import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const deleteAnnouncementSchema = z.object({
  id: z.string().uuid('Invalid announcement ID format'),
})

async function handleDelete(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const parseResult = deleteAnnouncementSchema.safeParse(body)

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid announcement deletion payload'
      return NextResponse.json({ success: false, error: firstError }, { status: 400 })
    }

    const { id } = parseResult.data

    // 1. Verify caller is an authenticated Admin
    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: No active session' }, { status: 401 })
    }

    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // 2. Perform deletion using Admin Client (service role) to guarantee DB execution
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const dbClient = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : serverSupabase

    const { data, error } = await dbClient
      .from('announcements')
      .delete()
      .eq('id', id)
      .select()

    if (error) {
      console.error('[API announcements/delete] Supabase error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: 'Announcement not found or delete failed' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: { deleted: data[0] } })
  } catch (err: unknown) {
    console.error('[API announcements/delete] Server error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  return handleDelete(request)
}

export async function POST(request: Request) {
  return handleDelete(request)
}

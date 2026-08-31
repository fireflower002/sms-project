import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const settingsSchema = z.object({
  absence_buffer_hours: z.number().int().min(0, 'Buffer hours cannot be negative').max(12, 'Buffer cannot exceed 12 hours'),
  working_days: z.array(z.string()).min(1, 'Select at least one school working day'),
  allow_emergency_absence: z.boolean(),
  auto_sync_holidays: z.boolean(),
})

export async function GET() {
  try {
    const serverSupabase = await createServerClient()
    const { data: settings } = await serverSupabase
      .from('school_settings')
      .select('*')
      .eq('school_id', 'default')
      .maybeSingle()

    return NextResponse.json({ success: true, data: { settings: settings || null } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching school settings'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const serverSupabase = await createServerClient()
    const { data: { user }, error: authErr } = await serverSupabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Session required' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parseResult = settingsSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: parseResult.error.issues[0]?.message || 'Invalid settings' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const dbClient = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : serverSupabase

    const { data: profile } = await dbClient.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin role required' }, { status: 403 })
    }

    const payload = {
      id: 'default',
      school_id: 'default',
      ...parseResult.data,
      updated_at: new Date().toISOString(),
    }

    const { data: updated, error: updateErr } = await dbClient
      .from('school_settings')
      .upsert(payload, { onConflict: 'school_id' })
      .select()
      .single()

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { settings: updated } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error updating settings'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

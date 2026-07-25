import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { absenceId } = await request.json()
    if (!absenceId) {
      return NextResponse.json({ error: 'Absence ID is required' }, { status: 400 })
    }

    // 1. Authenticate user
    const serverSupabase = await createServerClient()
    const { data: { user }, error: authErr } = await serverSupabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized: No active session' }, { status: 401 })
    }

    // 2. Setup Admin DB Client for guaranteed execution
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const dbClient = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : serverSupabase

    // 3. Verify ownership or admin role
    const { data: absence, error: findErr } = await dbClient
      .from('absences')
      .select('id, teacher_id')
      .eq('id', absenceId)
      .maybeSingle()

    if (findErr || !absence) {
      return NextResponse.json({ error: 'Absence record not found' }, { status: 404 })
    }

    if (absence.teacher_id !== user.id) {
      // Check if user is admin
      const { data: profile } = await dbClient.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden: You can only cancel your own absences' }, { status: 403 })
      }
    }

    // 4. Remove any substitutions tied to this absence
    await dbClient.from('substitutions').delete().eq('absence_id', absenceId)

    // 5. Delete absence record and verify deletion
    const { data: deleted, error: delErr } = await dbClient
      .from('absences')
      .delete()
      .eq('id', absenceId)
      .select()

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'Failed to cancel absence: 0 records deleted' }, { status: 500 })
    }

    return NextResponse.json({ success: true, deletedCount: deleted.length })
  } catch (err: any) {
    console.error('[API /api/teacher/cancel-absence] Error:', err)
    return NextResponse.json({ error: err?.message || 'Server error cancelling absence' }, { status: 500 })
  }
}

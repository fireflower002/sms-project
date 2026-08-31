import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rateLimit'

const cancelAbsenceSchema = z.object({
  absenceId: z.string().uuid('Invalid absence ID format'),
})

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request)
    const rateLimit = checkRateLimit(clientIp, '/api/teacher/cancel-absence', {
      windowMs: 60 * 1000,
      maxRequests: 10,
    })
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetInMs)
    }

    const body = await request.json().catch(() => ({}))
    const parseResult = cancelAbsenceSchema.safeParse(body)

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid cancel absence payload'
      return NextResponse.json({ success: false, error: firstError }, { status: 400 })
    }

    const { absenceId } = parseResult.data

    // 1. Authenticate user
    const serverSupabase = await createServerClient()
    const { data: { user }, error: authErr } = await serverSupabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: No active session' }, { status: 401 })
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
      return NextResponse.json({ success: false, error: 'Absence record not found' }, { status: 404 })
    }

    if (absence.teacher_id !== user.id) {
      // Check if user is admin
      const { data: profile } = await dbClient.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Forbidden: You can only cancel your own absences' }, { status: 403 })
      }
    }

    // 4. Fetch substitute assignment details before deletion for notification dispatch
    const { data: affectedSubs } = await dbClient
      .from('substitutions')
      .select('substitute_teacher_id, period_number, subject, class:classes(name)')
      .eq('absence_id', absenceId)

    const { data: absentProfile } = await dbClient
      .from('profiles')
      .select('full_name')
      .eq('id', absence.teacher_id)
      .maybeSingle()
    const absentTeacherName = absentProfile?.full_name || 'the teacher'

    // 5. Remove any substitutions tied to this absence
    await dbClient.from('substitutions').delete().eq('absence_id', absenceId)

    // 6. Delete absence record and verify deletion
    const { data: deleted, error: delErr } = await dbClient
      .from('absences')
      .delete()
      .eq('id', absenceId)
      .select()

    if (delErr) {
      return NextResponse.json({ success: false, error: delErr.message }, { status: 500 })
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ success: false, error: 'Failed to cancel absence: 0 records deleted' }, { status: 500 })
    }

    // 7. Dispatch substitute_unassigned notifications to affected substitute teachers
    if (affectedSubs && affectedSubs.length > 0) {
      const notifRows = affectedSubs
        .filter(sub => Boolean(sub.substitute_teacher_id))
        .map(sub => {
          const className = Array.isArray(sub.class) ? (sub.class[0] as any)?.name : (sub.class as any)?.name
          return {
            user_id: sub.substitute_teacher_id,
            type: 'substitute_unassigned',
            title: `Cover duty cancelled — Period ${sub.period_number}`,
            body: `The absence for ${absentTeacherName} was cancelled. You are no longer assigned to cover Period ${sub.period_number}${className ? ` for ${className}` : ''}.`,
            link: '/teacher/timetable',
            is_read: false,
          }
        })

      if (notifRows.length > 0) {
        const { error: notifErr } = await dbClient.from('notifications').insert(notifRows)
        if (notifErr) {
          console.warn('[API cancel-absence] Warning inserting substitute cancellation notifications:', notifErr.message)
        }
      }
    }

    return NextResponse.json({ success: true, data: { deletedCount: deleted.length } })
  } catch (err: unknown) {
    console.error('[API /api/teacher/cancel-absence] Error:', err)
    const message = err instanceof Error ? err.message : 'Server error cancelling absence'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

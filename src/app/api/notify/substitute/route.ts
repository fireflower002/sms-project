import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rateLimit'

const notifySubstituteSchema = z.object({
  substitute_teacher_id: z.string().uuid('Invalid substitute teacher ID'),
  substitute_name: z.string().optional().default(''),
  absent_teacher_name: z.string().optional().default(''),
  period_number: z.number().or(z.string()),
  class_name: z.string().optional().default(''),
  subject: z.string().optional().default(''),
  absence_date: z.string().optional().default(''),
  action: z.enum(['assign', 'unassign']).optional().default('assign'),
  absence_id: z.string().uuid('Invalid absence ID').optional(),
  substitution_id: z.string().uuid('Invalid substitution ID').optional(),
})

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request)
    const rateLimit = checkRateLimit(clientIp, '/api/notify/substitute', {
      windowMs: 60 * 1000,
      maxRequests: 10,
    })
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetInMs)
    }

    // 1. Authenticate caller session
    const serverSupabase = await createServerClient()
    const { data: { user }, error: authErr } = await serverSupabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parseResult = notifySubstituteSchema.safeParse(body)

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid notification payload'
      return NextResponse.json({ success: false, error: firstError }, { status: 400 })
    }

    const data = parseResult.data

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const dbClient = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : serverSupabase

    // 2. Query caller profile role and enforce two-sided authorization checks
    const { data: callerProfile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const callerRole = callerProfile?.role || 'teacher'

    if (callerRole !== 'admin') {
      // Check Side A: Caller is assigned substitute teacher (substitutions.substitute_teacher_id)
      let isAuthorizedTeacher = (user.id === data.substitute_teacher_id)

      // Check Side B: Caller is original absent teacher (substitutions.absence_id -> absences.teacher_id)
      if (!isAuthorizedTeacher) {
        let targetAbsenceId = data.absence_id

        // 1. If substitution_id passed, look up absence_id
        if (!targetAbsenceId && data.substitution_id) {
          const { data: subRow } = await dbClient
            .from('substitutions')
            .select('absence_id')
            .eq('id', data.substitution_id)
            .maybeSingle()
          if (subRow) targetAbsenceId = subRow.absence_id
        }

        // 2. Otherwise look up specific substitution row linking substitute_teacher_id + period_number + absence_date
        if (!targetAbsenceId && data.absence_date) {
          const periodNum = Number(data.period_number)
          const { data: subRow } = await dbClient
            .from('substitutions')
            .select('absence_id, absences!inner(teacher_id, absence_date)')
            .eq('substitute_teacher_id', data.substitute_teacher_id)
            .eq('period_number', periodNum)
            .eq('absences.absence_date', data.absence_date)
            .maybeSingle()

          if (subRow && subRow.absence_id) {
            targetAbsenceId = subRow.absence_id
          }
        }

        // 3. Verify target absence's teacher_id matches user.id
        if (targetAbsenceId) {
          const { data: absenceRow } = await dbClient
            .from('absences')
            .select('teacher_id')
            .eq('id', targetAbsenceId)
            .maybeSingle()

          if (absenceRow && absenceRow.teacher_id === user.id) {
            isAuthorizedTeacher = true
          }
        }
      }

      if (!isAuthorizedTeacher) {
        return NextResponse.json({
          success: false,
          error: 'Forbidden: Authorization required. Only an administrator, the assigned substitute teacher, or the absent teacher tied to this specific substitution can trigger this notification.'
        }, { status: 403 })
      }
    }

    const isUnassign = data.action === 'unassign'
    const formattedDate = data.absence_date ? new Date(data.absence_date + 'T12:00:00').toLocaleDateString('en-LK', { weekday: 'long', day: '2-digit', month: 'long' }) : 'upcoming date'
    const notificationTitle = isUnassign
      ? `Cover duty unassigned — Period ${data.period_number}`
      : `Cover duty — Period ${data.period_number}`
    const notificationBody = isUnassign
      ? `You have been unassigned from covering ${data.class_name || 'a class'}${data.subject ? ` (${data.subject})` : ''} on ${formattedDate}.`
      : `You are assigned to cover ${data.class_name || 'a class'}${data.subject ? ` (${data.subject})` : ''} on ${formattedDate}. Covering for ${data.absent_teacher_name || 'absent teacher'}.`

    const { error: notifErr } = await dbClient.from('notifications').insert({
      user_id: data.substitute_teacher_id,
      type: isUnassign ? 'substitute_unassigned' : 'substitute_assigned',
      title: notificationTitle,
      body: notificationBody,
      link: '/teacher/timetable',
      is_read: false,
    })

    if (notifErr) {
      console.warn('[API notify/substitute] Warning inserting notification:', notifErr.message)
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Substitute notification ${isUnassign ? 'unassigned' : 'created'}`
      }
    })
  } catch (err: unknown) {
    console.error('[API notify/substitute] Error:', err)
    const message = err instanceof Error ? err.message : 'Server error sending substitute notification'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rateLimit'

const deleteTeacherSchema = z.object({
  teacherId: z.string().uuid('Invalid teacher ID format'),
  reassignments: z.record(z.string(), z.string().nullable()).optional().default({}),
})

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const rateLimit = checkRateLimit(ip, 'delete-teacher', { maxRequests: 10, windowMs: 60 * 1000 })
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetInMs)
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error: missing Supabase environment variables.' },
        { status: 500 }
      )
    }

    const adminSupabase = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Verify caller is an authenticated Admin
    let callerUser = null
    try {
      const serverSupabase = await createServerClient()
      const { data: userData } = await serverSupabase.auth.getUser()
      callerUser = userData?.user
    } catch (e) {
      // Ignore server session check error
    }

    if (!callerUser) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        if (token && token !== 'undefined' && token !== 'null') {
          try {
            const { data: tokenUserData } = await adminSupabase.auth.getUser(token)
            if (tokenUserData?.user) callerUser = tokenUserData.user
          } catch (e) {
            // Ignore bearer token error
          }
        }
      }
    }

    if (!callerUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin authentication session required.' },
        { status: 401 }
      )
    }

    const { data: callerProfile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .maybeSingle()

    if (callerProfile?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin privilege required to delete teacher accounts.' },
        { status: 403 }
      )
    }

    // 2. Parse request body
    const body = await request.json().catch(() => ({}))
    const parsed = deleteTeacherSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid input parameters.' },
        { status: 400 }
      )
    }

    const { teacherId, reassignments } = parsed.data

    // Prevent Admin self-deletion via teacher endpoint
    if (teacherId === callerUser.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete your own active admin account.' },
        { status: 400 }
      )
    }

    // Fetch target teacher profile & allowed_users record before deletion
    const [{ data: targetProfile }, { data: targetAllowed }] = await Promise.all([
      adminSupabase.from('profiles').select('id, full_name, email').eq('id', teacherId).maybeSingle(),
      adminSupabase.from('allowed_users').select('id, email').eq('id', teacherId).maybeSingle(),
    ])

    const teacherEmail = targetProfile?.email || targetAllowed?.email

    // 3. Reassign Class Teacher Roles in database
    if (reassignments && Object.keys(reassignments).length > 0) {
      for (const [classId, newTeacherId] of Object.entries(reassignments)) {
        if (newTeacherId) {
          const { data: alreadyAssigned } = await adminSupabase
            .from('classes')
            .select('id, name')
            .eq('class_teacher_id', newTeacherId)
            .neq('id', classId)
            .maybeSingle()

          if (alreadyAssigned) {
            return NextResponse.json(
              { success: false, error: `Replacement teacher is already the Class Teacher for ${alreadyAssigned.name}.` },
              { status: 400 }
            )
          }
        }

        const { error: updateErr } = await adminSupabase
          .from('classes')
          .update({ class_teacher_id: newTeacherId })
          .eq('id', classId)

        if (updateErr) {
          return NextResponse.json(
            { success: false, error: `Failed to update class teacher: ${updateErr.message}` },
            { status: 500 }
          )
        }
      }
    }

    // Unassign any remaining class teacher links for this teacher
    await adminSupabase.from('classes').update({ class_teacher_id: null }).eq('class_teacher_id', teacherId)

    // 4. Clean up foreign key references across all public tables
    await adminSupabase.from('schedule_assignments').delete().eq('teacher_id', teacherId)
    await adminSupabase.from('substitutions').delete().eq('substitute_teacher_id', teacherId)
    await adminSupabase.from('swap_requests').delete().eq('requester_id', teacherId)
    await adminSupabase.from('swap_requests').delete().eq('target_teacher_id', teacherId)
    await adminSupabase.from('absences').delete().eq('teacher_id', teacherId)
    await adminSupabase.from('inventory').update({ assigned_to: null }).eq('assigned_to', teacherId)
    await adminSupabase.from('profile_change_requests').delete().eq('teacher_id', teacherId)
    await adminSupabase.from('announcement_reads').delete().eq('user_id', teacherId)
    await adminSupabase.from('notifications').delete().eq('user_id', teacherId)
    await adminSupabase.from('hive_messages').delete().eq('sender_id', teacherId)

    // 5. Delete from public.profiles & public.allowed_users
    await adminSupabase.from('profiles').delete().eq('id', teacherId)
    if (teacherEmail) {
      await adminSupabase.from('profiles').delete().eq('email', teacherEmail)
      await adminSupabase.from('allowed_users').delete().eq('email', teacherEmail)
    }
    await adminSupabase.from('allowed_users').delete().eq('id', teacherId)

    // 6. Permanently Delete User Account from Supabase Auth (auth.users)
    try {
      await adminSupabase.auth.admin.deleteUser(teacherId)
    } catch (authErr: any) {
      console.warn('Primary Auth deleteUser by ID notice:', authErr?.message)
    }

    if (teacherEmail) {
      try {
        const { data: authUsers } = await adminSupabase.auth.admin.listUsers()
        const matchingAuthUser = authUsers?.users?.find(
          (u) => u.email?.toLowerCase() === teacherEmail.toLowerCase()
        )
        if (matchingAuthUser) {
          await adminSupabase.auth.admin.deleteUser(matchingAuthUser.id)
        }
      } catch (authListErr: any) {
        console.warn('Secondary Auth search delete notice:', authListErr?.message)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Permanently deleted teacher account and all associated data for ${targetProfile?.full_name || 'teacher'}.`,
    })
  } catch (error: any) {
    console.error('Unhandled error in delete-teacher API route:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'An unexpected error occurred during teacher account deletion.' },
      { status: 500 }
    )
  }
}

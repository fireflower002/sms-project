import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const notifySubstituteSchema = z.object({
  substitute_teacher_id: z.string().uuid('Invalid substitute teacher ID'),
  substitute_name: z.string().optional().default(''),
  absent_teacher_name: z.string().optional().default(''),
  period_number: z.number().or(z.string()),
  class_name: z.string().optional().default(''),
  subject: z.string().optional().default(''),
  absence_date: z.string().optional().default(''),
  action: z.enum(['assign', 'unassign']).optional().default('assign'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const parseResult = notifySubstituteSchema.safeParse(body)

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid notification payload'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const data = parseResult.data

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const dbClient = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : await createServerClient()

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

    return NextResponse.json({ success: true, message: `Substitute notification ${isUnassign ? 'unassigned' : 'created'}` })
  } catch (err: any) {
    console.error('[API notify/substitute] Error:', err)
    return NextResponse.json({ error: err?.message || 'Server error sending substitute notification' }, { status: 500 })
  }
}

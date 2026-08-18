import { createClient } from '@/lib/supabase/server'
import TeacherDetailClient from '@/components/admin/TeacherDetailClient'

export const dynamic = 'force-dynamic'

export default async function TeacherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: prof }, { data: allowed }, { data: activeTemplate }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, subjects, is_active, must_change_password, created_at')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('allowed_users')
      .select('id, full_name, email, phone, role, subjects, must_change_password, created_at')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('timetable_templates')
      .select('id')
      .eq('is_active', true)
      .maybeSingle(),
  ])

  let teacherData: any = prof
  if (!teacherData && allowed) {
    teacherData = {
      id: allowed.id,
      full_name: allowed.full_name,
      email: allowed.email,
      phone: allowed.phone || null,
      role: 'teacher',
      subjects: allowed.subjects || [],
      is_active: true,
      must_change_password: allowed.must_change_password ?? true,
      is_pending: true,
      created_at: allowed.created_at,
    }
  }

  let scheduleData: any[] = []
  if (activeTemplate && id) {
    const { data: schedData } = await supabase
      .from('schedule_assignments')
      .select('*, class:classes(name, grade_level)')
      .eq('template_id', activeTemplate.id)
      .eq('teacher_id', id)
      .order('day_of_week')
      .order('period_number')

    scheduleData = schedData || []
  }

  const [{ data: absData }, { data: swapData }] = await Promise.all([
    supabase.from('absences').select('*').eq('teacher_id', id).order('absence_date', { ascending: false }).limit(5),
    supabase
      .from('swap_requests')
      .select('*, requester:profiles!requester_id(full_name), target:profiles!target_teacher_id(full_name)')
      .or(`requester_id.eq.${id},target_teacher_id.eq.${id}`)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const initialData = {
    teacher: teacherData,
    schedule: scheduleData,
    absences: absData || [],
    swaps: swapData || [],
  }

  return <TeacherDetailClient teacherId={id} initialData={initialData} />
}

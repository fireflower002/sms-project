import { createClient } from '@/lib/supabase/server'
import TeacherDashboardClient from '@/components/teacher/TeacherDashboardClient'
import { todaySLT, todayDayOfWeek } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function TeacherPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  let dashData: any = { schedule: [], template: null, announcements: [], substitutions: [] }

  if (user) {
    const { data: fetchProf } = await supabase.from('profiles').select('id, full_name, email, phone, role, subjects, is_active, must_change_password').eq('id', user.id).maybeSingle()
    profile = fetchProf

    if (profile && profile.role !== 'admin') {
      const today = todaySLT()
      const todayDay = todayDayOfWeek()

      const [schedule, template, announcements, substitutions] = await Promise.all([
        supabase.from('schedule_assignments').select('*,class:classes(name,grade_level)').eq('teacher_id', user.id).eq('day_of_week', todayDay).order('period_number'),
        supabase.from('timetable_templates').select('*').eq('is_active', true).maybeSingle(),
        supabase.from('announcements').select('id,title,body,created_at,priority').eq('is_published', true).eq('is_active', true).order('created_at', { ascending: false }).limit(3),
        supabase.from('substitutions').select('*,class:classes(name),absence:absences!absence_id!inner(absence_date,teacher:profiles!teacher_id(full_name))').eq('substitute_teacher_id', user.id).eq('absence.absence_date', today),
      ])

      const formattedSubs = (substitutions.data || []).map((s: any) => ({
        ...s,
        original: s.absence?.teacher || null,
      }))

      dashData = {
        schedule: schedule.data || [],
        template: template.data,
        announcements: announcements.data || [],
        substitutions: formattedSubs,
      }
    }
  }

  const initialData = user && profile ? {
    profile,
    data: dashData
  } : undefined

  return <TeacherDashboardClient initialData={initialData} />
}

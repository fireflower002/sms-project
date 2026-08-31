import { createClient } from '@/lib/supabase/server'
import TeacherTimetableClient from '@/components/teacher/TeacherTimetableClient'
import { todaySLT } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function TeacherTimetablePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <TeacherTimetableClient initialData={{ template: null, schedule: [], reliefDuties: [], subjectColors: {} }} />
  }

  const userId = user.id
  const todayStr = todaySLT()

  const [{ data: tmpl }, { data: asgn }, { data: prof }, { data: subData }] = await Promise.all([
    supabase.from('timetable_templates').select('*').eq('is_active', true).maybeSingle(),
    supabase.from('schedule_assignments').select('*,class:classes(name,grade_level)').eq('teacher_id', userId).order('day_of_week').order('period_number'),
    supabase.from('profiles').select('subject_colors').eq('id', userId).maybeSingle(),
    supabase.from('substitutions')
      .select('*, absence:absences!absence_id!inner(absence_date, teacher:profiles!teacher_id(full_name)), class:classes(name,grade_level)')
      .eq('substitute_teacher_id', userId)
      .gte('absence.absence_date', todayStr)
      .in('status', ['assigned', 'swap_requested', 'confirmed'])
      .order('created_at', { ascending: false }),
  ])

  const activeRelief = subData || []

  const initialData = {
    template: tmpl || null,
    schedule: asgn || [],
    reliefDuties: activeRelief,
    subjectColors: prof?.subject_colors || {},
  }

  return <TeacherTimetableClient initialData={initialData} />
}

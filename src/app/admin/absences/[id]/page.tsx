import { createClient } from '@/lib/supabase/server'
import AbsenceDetailClient from '@/components/admin/AbsenceDetailClient'

export const dynamic = 'force-dynamic'

export default async function AbsenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: abs }, { data: subData }, { data: teachers }, { data: tmpl }] = await Promise.all([
    supabase.from('absences')
      .select('*, teacher:profiles!teacher_id(id,full_name,email,subjects)')
      .eq('id', id).maybeSingle(),
    supabase.from('substitutions')
      .select('*, substitute:profiles!substitute_teacher_id(id,full_name), class:classes!class_id(name)')
      .eq('absence_id', id)
      .order('period_number'),
    supabase.from('profiles').select('id,full_name,subjects').eq('role','teacher').eq('is_active',true).order('full_name'),
    supabase.from('timetable_templates').select('*').eq('is_active',true).maybeSingle(),
  ])

  const initialData = {
    absence: abs,
    subs: subData || [],
    allTeachers: teachers || [],
    template: tmpl || null,
  }

  return <AbsenceDetailClient absenceId={id} initialData={initialData} />
}
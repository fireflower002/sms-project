import { createClient } from '@/lib/supabase/server'
import ClassesClient from '@/components/admin/ClassesClient'

export const dynamic = 'force-dynamic'

export default async function ClassesPage() {
  const supabase = await createClient()

  const [{ data: tch }, { data: tmplData }, { data: rawData }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, subjects').eq('role', 'teacher').eq('is_active', true).order('full_name'),
    supabase.from('timetable_templates').select('id').eq('is_active', true).maybeSingle(),
    supabase.from('classes').select('*').eq('is_active', true).order('grade_level').order('name'),
  ])

  const teacherList = tch || []
  const hasActiveTemplate = Boolean(tmplData)
  const sourceData = rawData || []

  const mapped = sourceData.map((c: any) => {
    const ctId = c.class_teacher_id
    const ctPer = c.class_teacher_periods || 1
    const ctSub = c.class_teacher_subject

    return {
      ...c,
      class_teacher_id: ctId,
      class_teacher_periods: ctPer,
      class_teacher_subject: ctSub,
      class_teacher: ctId ? teacherList.find(t => t.id === ctId) : undefined
    }
  }).sort((a: any, b: any) => a.grade_level - b.grade_level || a.name.localeCompare(b.name, undefined, { numeric: true }))

  const initialData = {
    classes: mapped,
    teachers: teacherList,
    hasActiveTemplate,
  }

  return <ClassesClient initialData={initialData} />
}

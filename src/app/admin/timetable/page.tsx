import { createClient } from '@/lib/supabase/server'
import TimetableClient from '@/components/admin/TimetableClient'

export const dynamic = 'force-dynamic'

export default async function TimetablePage() {
  const supabase = await createClient()
  const { data } = await supabase.from('timetable_templates').select('*').order('created_at', { ascending: false })

  return <TimetableClient initialTemplates={data || []} />
}

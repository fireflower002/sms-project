import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function AbsencesRedirectPage() {
  redirect('/admin/disruptions?tab=absences')
}

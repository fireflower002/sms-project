import { redirect } from 'next/navigation'

export default function AbsencesRedirectPage() {
  redirect('/admin/disruptions?tab=absences')
}

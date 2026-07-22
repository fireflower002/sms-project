import { redirect } from 'next/navigation'

export default function SwapsRedirectPage() {
  redirect('/admin/disruptions?tab=swaps')
}

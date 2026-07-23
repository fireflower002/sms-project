import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function SwapsRedirectPage() {
  redirect('/admin/disruptions?tab=swaps')
}

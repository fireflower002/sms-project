import { createClient } from '@/lib/supabase/server'
import PublicItemDetailClient from '@/components/public/PublicItemDetailClient'

export const dynamic = 'force-dynamic'

export default async function PublicItemDetailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const cleanToken = (token || '').trim()
  const fields = 'id, name, description, category, condition, condition_notes, quantity_total, quantity_available, location, assigned_role, assigned_at, public_token, barcode, is_active'
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanToken)

  let targetData: any = null
  let lastError: any = null

  if (isUuid) {
    const { data, error } = await supabase
      .from('public_inventory_verification')
      .select(fields)
      .eq('public_token', cleanToken)
      .maybeSingle()

    if (data) targetData = data
    if (error && error.code !== 'PGRST116') lastError = error
  }

  if (!targetData && isUuid) {
    const { data, error } = await supabase
      .from('public_inventory_verification')
      .select(fields)
      .eq('id', cleanToken)
      .maybeSingle()

    if (data) targetData = data
    if (error && error.code !== 'PGRST116') lastError = error
  }

  if (!targetData) {
    const { data, error } = await supabase
      .from('public_inventory_verification')
      .select(fields)
      .eq('barcode', cleanToken)
      .maybeSingle()

    if (data) targetData = data
    if (error && error.code !== 'PGRST116') lastError = error
  }

  let errorState: 'not_found' | 'inactive' | 'permission_error' | null = null
  let errorDetail = ''

  if (!targetData) {
    if (lastError) {
      errorState = 'permission_error'
      errorDetail = lastError.message || 'Database permissions or column configuration issue.'
    } else {
      errorState = 'not_found'
    }
  } else if (!targetData.is_active) {
    errorState = 'inactive'
  }

  let assigneeRole: string | null = null
  if (targetData?.assigned_role) {
    const roleNormalized = targetData.assigned_role.toLowerCase()
    if (roleNormalized === 'admin') assigneeRole = 'Administrator'
    else if (roleNormalized === 'teacher') assigneeRole = 'Teacher / Staff'
    else if (roleNormalized === 'student') assigneeRole = 'Student'
    else assigneeRole = targetData.assigned_role
  }

  const initialData = {
    item: targetData,
    assigneeRole,
    errorState,
    errorDetail,
  }

  return <PublicItemDetailClient token={token} initialData={initialData} />
}

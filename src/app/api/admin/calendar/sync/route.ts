import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const serverSupabase = await createServerClient()
    const { data: { user }, error: authErr } = await serverSupabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 })
    }

    // Verify admin role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const dbClient = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : serverSupabase

    const { data: profile } = await dbClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required to run calendar sync' }, { status: 403 })
    }

    const currentYear = new Date().getFullYear()
    const yearsToSync = [currentYear, currentYear + 1]
    const schoolId = 'default'
    let addedCount = 0
    let updatedCount = 0
    const errors: string[] = []

    for (const year of yearsToSync) {
      try {
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/LK`, {
          headers: { 'User-Agent': 'HiveSMS-SchoolCalendarSync/1.0' },
          next: { revalidate: 0 },
        })

        if (!res.ok) {
          errors.push(`Failed fetching holidays for year ${year}: HTTP ${res.status}`)
          continue
        }

        const holidays: any[] = await res.json()
        if (!Array.isArray(holidays)) continue

        for (const h of holidays) {
          if (!h.date || !h.name) continue

          const eventDate = h.date
          const title = h.localName || h.name
          const externalId = `nager_lk_${year}_${h.date}_${h.name.replace(/[^a-zA-Z0-9]/g, '')}`

          // Check if an existing manual/admin entry exists on this date to preserve manual edits
          const { data: existing } = await dbClient
            .from('school_calendar_events')
            .select('id, source')
            .eq('school_id', schoolId)
            .eq('event_date', eventDate)
            .maybeSingle()

          if (existing && (existing.source === 'manual' || existing.source === 'admin')) {
            // Do not overwrite manual admin-created holidays
            continue
          }

          const payload = {
            school_id: schoolId,
            event_date: eventDate,
            title: title,
            description: `Official Sri Lanka Holiday (${h.name})`,
            event_type: 'public_holiday',
            source: 'api_sync',
            is_working_day: false,
            external_id: externalId,
            synced_at: new Date().toISOString(),
            created_by: user.id,
            updated_at: new Date().toISOString(),
          }

          const { error: upsertErr } = await dbClient
            .from('school_calendar_events')
            .upsert(payload, { onConflict: 'school_id,event_date,event_type' })

          if (upsertErr) {
            console.error(`[CalendarSync] Error upserting ${eventDate}:`, upsertErr)
          } else {
            if (existing) updatedCount++
            else addedCount++
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown network error'
        errors.push(`Network error fetching ${year} holidays: ${errMsg}`)
      }
    }

    const syncStatus = errors.length === 0 ? 'success' : 'failed'

    // Update school_settings last_holiday_sync_at
    await dbClient
      .from('school_settings')
      .upsert({
        id: 'default',
        school_id: schoolId,
        last_holiday_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'school_id' })

    // Log to calendar_sync_logs
    await dbClient.from('calendar_sync_logs').insert({
      school_id: schoolId,
      status: syncStatus,
      records_added: addedCount,
      records_updated: updatedCount,
      error_message: errors.length > 0 ? errors.join('; ') : null,
      created_by: user.id,
    })

    // Log to calendar_audit_logs
    await dbClient.from('calendar_audit_logs').insert({
      school_id: schoolId,
      action: 'synced',
      changed_by: user.id,
      new_value: { addedCount, updatedCount, syncStatus, yearsToSync },
    })

    return NextResponse.json({
      success: true,
      data: {
        status: syncStatus,
        recordsAdded: addedCount,
        recordsUpdated: updatedCount,
        errors: errors.length > 0 ? errors : undefined,
      }
    })
  } catch (err: unknown) {
    console.error('[API /api/admin/calendar/sync] Unexpected error:', err)
    const message = err instanceof Error ? err.message : 'Server error syncing calendar holidays'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

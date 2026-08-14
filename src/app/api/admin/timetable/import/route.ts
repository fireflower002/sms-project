import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const rowSchema = z.object({
  rowNumber: z.number(),
  className: z.string(),
  teacherName: z.string(),
  subject: z.string(),
  day: z.number().min(1).max(5),
  period: z.number().min(1).max(10),
  room: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  matchedTeacherId: z.string().uuid(),
  matchedClassId: z.string().uuid().nullable().optional(),
})

const importPayloadSchema = z.object({
  academicYear: z.string().min(4, 'Academic year is required'),
  fileName: z.string().min(1, 'File name is required'),
  templateId: z.string().uuid().optional(),
  replaceExisting: z.boolean().default(false),
  rows: z.array(rowSchema).min(1, 'No valid timetable rows provided for import'),
})

export async function POST(request: Request) {
  const schoolId = 'default'
  try {
    const serverSupabase = await createServerClient()
    const { data: { user }, error: authErr } = await serverSupabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const dbClient = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : serverSupabase

    // Verify admin role
    const { data: profile } = await dbClient.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin authorization required' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const parseResult = importPayloadSchema.safeParse(body)
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'Invalid import payload'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { academicYear, fileName, templateId: inputTemplateId, replaceExisting, rows } = parseResult.data

    // Step 1: Ensure active timetable template exists or create one for this import
    let targetTemplateId = inputTemplateId
    if (!targetTemplateId) {
      const { data: existingActive } = await dbClient
        .from('timetable_templates')
        .select('id')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .maybeSingle()

      if (existingActive) {
        targetTemplateId = existingActive.id
      } else {
        // Create new active template
        const { data: newTmpl, error: tmplErr } = await dbClient
          .from('timetable_templates')
          .insert({
            school_id: schoolId,
            name: `Imported Timetable (${academicYear})`,
            start_time: '07:30',
            end_time: '13:30',
            period_duration: 40,
            breaks: [{ after_period: 4, duration: 30, label: 'Interval' }],
            is_active: true,
            academic_year: academicYear,
            uploaded_by: user.id,
            uploaded_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (tmplErr || !newTmpl) {
          return NextResponse.json({ error: `Failed creating timetable template: ${tmplErr?.message}` }, { status: 500 })
        }
        targetTemplateId = newTmpl.id
      }
    }

    // Step 2: Create batch tracking record in timetable_imports (Status: 'processing')
    const { data: batch, error: batchErr } = await dbClient
      .from('timetable_imports')
      .insert({
        school_id: schoolId,
        template_id: targetTemplateId,
        academic_year: academicYear,
        file_name: fileName,
        status: 'processing',
        total_rows: rows.length,
        imported_by: user.id,
      })
      .select()
      .single()

    if (batchErr || !batch) {
      return NextResponse.json({ error: `Failed creating import tracking batch: ${batchErr?.message}` }, { status: 500 })
    }

    const batchId = batch.id

    // Step 3: Handle Replacement (Archive existing timetable records for this academic year)
    if (replaceExisting) {
      await dbClient
        .from('schedule_assignments')
        .update({ is_archived: true })
        .eq('school_id', schoolId)
        .eq('academic_year', academicYear)

      await dbClient
        .from('timetable_templates')
        .update({ is_archived: true, is_active: false })
        .eq('school_id', schoolId)
        .eq('academic_year', academicYear)
        .neq('id', targetTemplateId)
    }

    // Step 4: Auto-create missing classes if matchedClassId is null
    const classIdMap = new Map<string, string>()
    for (const r of rows) {
      if (r.matchedClassId) {
        classIdMap.set(r.className.toLowerCase().trim(), r.matchedClassId)
      } else {
        const cLower = r.className.toLowerCase().trim()
        if (!classIdMap.has(cLower)) {
          const slug = cLower.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
          const gradeLevel = parseInt(cLower.replace(/[^0-9]/g, '')) || 1

          const { data: createdClass, error: classErr } = await dbClient
            .from('classes')
            .insert({
              name: r.className.trim(),
              grade_level: gradeLevel,
              slug: slug || `class-${Date.now()}`,
              is_active: true,
            })
            .select('id')
            .single()

          if (!classErr && createdClass) {
            classIdMap.set(cLower, createdClass.id)
          }
        }
      }
    }

    // Step 5: Build schedule_assignments payload
    const assignmentsPayload: any[] = []
    const failedRows: any[] = []

    for (const r of rows) {
      const classId = r.matchedClassId || classIdMap.get(r.className.toLowerCase().trim())
      if (!classId || !r.matchedTeacherId) {
        failedRows.push({ rowNumber: r.rowNumber, error: 'Unresolved Class or Teacher ID' })
        continue
      }

      assignmentsPayload.push({
        template_id: targetTemplateId,
        class_id: classId,
        teacher_id: r.matchedTeacherId,
        day_of_week: r.day,
        period_number: r.period,
        subject: r.subject.trim(),
        subject_color: r.color || null,
        room: r.room || null,
        academic_year: academicYear,
        import_batch_id: batchId,
        school_id: schoolId,
        is_archived: false,
      })
    }

    // Step 6: Atomic Insert of schedule_assignments
    if (assignmentsPayload.length > 0) {
      const { error: insertErr } = await dbClient
        .from('schedule_assignments')
        .upsert(assignmentsPayload, { onConflict: 'template_id,class_id,day_of_week,period_number' })

      if (insertErr) {
        console.error('[ImportAPI] Bulk insert error, rolling back batch:', insertErr)
        // Rollback batch tracking status
        await dbClient.from('timetable_imports').update({ status: 'rolled_back', error_log: [{ error: insertErr.message }] }).eq('id', batchId)
        return NextResponse.json({ error: `Import failed during DB insertion: ${insertErr.message}. All changes rolled back.` }, { status: 500 })
      }
    }

    // Step 7: Update batch tracking record status to 'completed'
    await dbClient
      .from('timetable_imports')
      .update({
        status: 'completed',
        successful_rows: assignmentsPayload.length,
        failed_rows: failedRows.length,
        error_log: failedRows,
      })
      .eq('id', batchId)

    // Update timetable template details
    await dbClient
      .from('timetable_templates')
      .update({
        academic_year: academicYear,
        import_batch_id: batchId,
        is_active: true,
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString(),
      })
      .eq('id', targetTemplateId)

    return NextResponse.json({
      success: true,
      batchId,
      academicYear,
      importedCount: assignmentsPayload.length,
      failedCount: failedRows.length,
    })
  } catch (err: any) {
    console.error('[API /api/admin/timetable/import] Unexpected error:', err)
    return NextResponse.json({ error: err?.message || 'Server error processing timetable import' }, { status: 500 })
  }
}

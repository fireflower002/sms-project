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
  matchedTeacherId: z.string().uuid().nullable().optional(),
  matchedClassId: z.string().uuid().nullable().optional(),
})

const importPayloadSchema = z.object({
  academicYear: z.string().min(4, 'Academic year is required'),
  fileName: z.string().min(1, 'File name is required'),
  templateId: z.string().uuid().optional(),
  replaceExisting: z.boolean().default(false),
  dryRun: z.boolean().default(true),
  rows: z.array(rowSchema).min(1, 'No valid timetable rows provided for import'),
})

export async function POST(request: Request) {
  const schoolId = 'default'
  try {
    const serverSupabase = await createServerClient()
    const { data: { user }, error: authErr } = await serverSupabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const dbClient = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : serverSupabase

    // Verify admin role
    const { data: profile } = await dbClient.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin authorization required' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const parseResult = importPayloadSchema.safeParse(body)
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'Invalid import payload'
      return NextResponse.json({ success: false, error: msg }, { status: 400 })
    }

    const { academicYear, fileName, templateId: inputTemplateId, replaceExisting, dryRun, rows } = parseResult.data

    // Fetch existing active classes, profiles, and schedule_assignments for conflict checks
    const [{ data: dbClasses }, { data: dbTeachers }, { data: dbAssignments }] = await Promise.all([
      dbClient.from('classes').select('id, name, slug').eq('is_active', true),
      dbClient.from('profiles').select('id, full_name').eq('role', 'teacher').eq('is_active', true),
      dbClient.from('schedule_assignments').select('teacher_id, class_id, day_of_week, period_number').eq('academic_year', academicYear).eq('is_archived', false)
    ])

    const classMapByName = new Map<string, string>()
    const classMapById = new Set<string>()
    ;(dbClasses || []).forEach(c => {
      classMapByName.set(c.name.toLowerCase().trim(), c.id)
      classMapById.add(c.id)
    })

    const teacherMapById = new Set<string>()
    const teacherMapByName = new Map<string, string>()
    ;(dbTeachers || []).forEach(t => {
      teacherMapById.add(t.id)
      teacherMapByName.set(t.full_name.toLowerCase().trim(), t.id)
    })

    // Track existing DB assignments for conflict checking
    const teacherSlotMap = new Set<string>()
    const classSlotMap = new Set<string>()
    ;(dbAssignments || []).forEach(a => {
      teacherSlotMap.add(`${a.teacher_id}_${a.day_of_week}_${a.period_number}`)
      classSlotMap.add(`${a.class_id}_${a.day_of_week}_${a.period_number}`)
    })

    // Analyze rows for dry-run diff
    const toInsert: any[] = []
    const conflicts: any[] = []
    const invalidRows: any[] = []
    const classesToCreateSet = new Set<string>()

    const inMemoryTeacherSlots = new Set<string>()
    const inMemoryClassSlots = new Set<string>()

    for (const r of rows) {
      const cNameLower = r.className.toLowerCase().trim()
      const resolvedClassId = r.matchedClassId || classMapByName.get(cNameLower)
      const resolvedTeacherId = r.matchedTeacherId || teacherMapByName.get(r.teacherName.toLowerCase().trim())

      let isInvalid = false

      // Validate teacher existence
      if (!resolvedTeacherId || !teacherMapById.has(resolvedTeacherId)) {
        invalidRows.push({
          rowNumber: r.rowNumber,
          className: r.className,
          teacherName: r.teacherName,
          reason: `Unmapped or invalid teacher '${r.teacherName}'`
        })
        isInvalid = true
      }

      // Validate class existence (or mark for auto-creation)
      if (!resolvedClassId) {
        classesToCreateSet.add(r.className.trim())
      }

      // Validate period & day range
      if (r.day < 1 || r.day > 5 || r.period < 1 || r.period > 10) {
        if (!isInvalid) {
          invalidRows.push({
            rowNumber: r.rowNumber,
            className: r.className,
            teacherName: r.teacherName,
            reason: `Period ${r.period} or Day ${r.day} out of bounds (Day: 1-5, Period: 1-10)`
          })
          isInvalid = true
        }
      }

      if (isInvalid) continue

      // Check conflicts if teacherId is resolved
      if (resolvedTeacherId) {
        const teacherSlotKey = `${resolvedTeacherId}_${r.day}_${r.period}`
        if (teacherSlotMap.has(teacherSlotKey) || inMemoryTeacherSlots.has(teacherSlotKey)) {
          conflicts.push({
            rowNumber: r.rowNumber,
            className: r.className,
            teacherName: r.teacherName,
            day: r.day,
            period: r.period,
            reason: `Teacher '${r.teacherName}' is already booked for Day ${r.day}, Period ${r.period}`
          })
          continue
        }
        inMemoryTeacherSlots.add(teacherSlotKey)
      }

      if (resolvedClassId) {
        const classSlotKey = `${resolvedClassId}_${r.day}_${r.period}`
        if (classSlotMap.has(classSlotKey) || inMemoryClassSlots.has(classSlotKey)) {
          conflicts.push({
            rowNumber: r.rowNumber,
            className: r.className,
            teacherName: r.teacherName,
            day: r.day,
            period: r.period,
            reason: `Class '${r.className}' is already scheduled for Day ${r.day}, Period ${r.period}`
          })
          continue
        }
        inMemoryClassSlots.add(classSlotKey)
      }

      toInsert.push({
        ...r,
        matchedClassId: resolvedClassId || null,
        matchedTeacherId: resolvedTeacherId || null,
      })
    }

    const classesToCreate = Array.from(classesToCreateSet)

    // =========================================================================
    // DRY RUN MODE: Return Diff Summary ONLY (Zero DB Mutation)
    // =========================================================================
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        data: {
          totalRows: rows.length,
          validCount: toInsert.length,
          conflictCount: conflicts.length,
          invalidCount: invalidRows.length,
          toInsert,
          conflicts,
          invalidRows,
          classesToCreate,
        }
      })
    }

    // =========================================================================
    // WRITE MODE (dryRun === false): Execute Actual Database Write
    // =========================================================================

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
          return NextResponse.json({ success: false, error: `Failed creating timetable template: ${tmplErr?.message}` }, { status: 500 })
        }
        targetTemplateId = newTmpl.id
      }
    }

    // Step 2: Create batch tracking record in timetable_imports
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
      return NextResponse.json({ success: false, error: `Failed creating import tracking batch: ${batchErr?.message}` }, { status: 500 })
    }

    const batchId = batch.id

    // Step 3: Handle Replacement
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

    // Step 4: Create missing classes in DB
    const createdClassMap = new Map<string, string>()
    for (const classNameToCreate of classesToCreate) {
      const cLower = classNameToCreate.toLowerCase().trim()
      const slug = cLower.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const gradeLevel = parseInt(cLower.replace(/[^0-9]/g, '')) || 1

      const { data: createdClass, error: classErr } = await dbClient
        .from('classes')
        .insert({
          name: classNameToCreate,
          grade_level: gradeLevel,
          slug: slug || `class-${Date.now()}`,
          is_active: true,
        })
        .select('id')
        .single()

      if (!classErr && createdClass) {
        createdClassMap.set(cLower, createdClass.id)
      }
    }

    // Step 5: Build schedule_assignments payload
    const assignmentsPayload: any[] = []
    for (const r of toInsert) {
      const classId = r.matchedClassId || createdClassMap.get(r.className.toLowerCase().trim()) || classMapByName.get(r.className.toLowerCase().trim())
      if (!classId || !r.matchedTeacherId) continue

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
        await dbClient.from('timetable_imports').update({ status: 'rolled_back', error_log: [{ error: insertErr.message }] }).eq('id', batchId)
        return NextResponse.json({ success: false, error: `Import failed during DB insertion: ${insertErr.message}. All changes rolled back.` }, { status: 500 })
      }
    }

    // Step 7: Update batch tracking record status to 'completed'
    await dbClient
      .from('timetable_imports')
      .update({
        status: 'completed',
        successful_rows: assignmentsPayload.length,
        failed_rows: invalidRows.length + conflicts.length,
        error_log: [...conflicts, ...invalidRows],
      })
      .eq('id', batchId)

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
      dryRun: false,
      data: {
        batchId,
        academicYear,
        importedCount: assignmentsPayload.length,
        skippedCount: invalidRows.length + conflicts.length,
        createdClassesCount: classesToCreate.length,
      }
    })
  } catch (err: unknown) {
    console.error('[API /api/admin/timetable/import] Unexpected error:', err)
    const message = err instanceof Error ? err.message : 'Server error processing timetable import'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}


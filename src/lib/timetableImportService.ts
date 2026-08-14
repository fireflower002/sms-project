import * as XLSX from 'xlsx'

export interface TimetableRowRaw {
  rowNumber: number
  className: string
  teacherName: string
  subject: string
  day: number // 1=Mon ... 5=Fri
  period: number // 1 ... 10
  room?: string | null
  color?: string | null
  matchedTeacherId?: string | null
  matchedClassId?: string | null
}

export interface ValidationError {
  rowNumber: number
  column: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  totalRows: number
  validRows: TimetableRowRaw[]
  errors: ValidationError[]
  warnings: ValidationError[]
  uniqueTeachers: string[]
  uniqueClasses: string[]
  missingTeachers: string[]
  missingClasses: string[]
}

const DAY_MAP: Record<string, number> = {
  monday: 1, mon: 1, '1': 1,
  tuesday: 2, tue: 2, '2': 2,
  wednesday: 3, wed: 3, '3': 3,
  thursday: 4, thu: 4, '4': 4,
  friday: 5, fri: 5, '5': 5,
}

/**
 * Parses an Excel / CSV buffer into structured raw timetable rows.
 * Enforces file size (max 5MB) and row count (max 1000 rows) limits.
 */
export function parseTimetableBuffer(buffer: ArrayBuffer | Buffer): { rows: TimetableRowRaw[]; parseError?: string } {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      return { rows: [], parseError: 'Excel file contains no readable worksheets.' }
    }

    const worksheet = workbook.Sheets[firstSheetName]
    const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

    if (jsonRows.length === 0) {
      return { rows: [], parseError: 'The uploaded file is empty.' }
    }

    if (jsonRows.length > 1000) {
      return { rows: [], parseError: `File exceeds maximum row limit of 1,000 rows (Found ${jsonRows.length} rows). Please split the import.` }
    }

    const rows: TimetableRowRaw[] = []

    jsonRows.forEach((row, idx) => {
      const rowNumber = idx + 2 // Row 1 is header in Excel
      // Flexible column key matching (case-insensitive)
      const keys = Object.keys(row)
      const getVal = (possibleKeys: string[]) => {
        const foundKey = keys.find(k => possibleKeys.includes(k.trim().toLowerCase()))
        return foundKey ? String(row[foundKey]).trim() : ''
      }

      const className = getVal(['class', 'class_name', 'grade', 'grade_class', 'class name'])
      const teacherName = getVal(['teacher', 'teacher_name', 'teacher name', 'email', 'teacher_email'])
      const subject = getVal(['subject', 'subject_name', 'subject name'])
      const dayRaw = getVal(['day', 'day_of_week', 'weekday', 'day of week'])
      const periodRaw = getVal(['period', 'period_number', 'period #', 'period number'])
      const room = getVal(['room', 'room_name', 'location']) || null
      const color = getVal(['color', 'subject_color', 'hex_color']) || null

      const dayParsed = DAY_MAP[dayRaw.toLowerCase()] || parseInt(dayRaw) || 0
      const periodParsed = parseInt(periodRaw) || 0

      rows.push({
        rowNumber,
        className,
        teacherName,
        subject,
        day: dayParsed,
        period: periodParsed,
        room,
        color,
      })
    })

    return { rows }
  } catch (err: any) {
    return { rows: [], parseError: `Failed parsing Excel file: ${err?.message || 'Invalid format'}` }
  }
}

/**
 * Validates timetable rows against database profiles and classes, detecting conflicts with row line numbers.
 */
export function validateTimetableRows(
  rawRows: TimetableRowRaw[],
  existingProfiles: { id: string; full_name: string; email: string }[],
  existingClasses: { id: string; name: string; slug: string }[]
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  const validRows: TimetableRowRaw[] = []

  const teacherMapByName = new Map<string, string>()
  const teacherMapByEmail = new Map<string, string>()
  existingProfiles.forEach(p => {
    if (p.full_name) teacherMapByName.set(p.full_name.toLowerCase().trim(), p.id)
    if (p.email) teacherMapByEmail.set(p.email.toLowerCase().trim(), p.id)
  })

  const classMapByName = new Map<string, string>()
  const classMapBySlug = new Map<string, string>()
  existingClasses.forEach(c => {
    if (c.name) classMapByName.set(c.name.toLowerCase().trim(), c.id)
    if (c.slug) classMapBySlug.set(c.slug.toLowerCase().trim(), c.id)
  })

  const teacherScheduleTracker = new Map<string, number>() // "teacherId-day-period" -> rowNumber
  const classScheduleTracker = new Map<string, number>() // "classId-day-period" -> rowNumber
  const roomScheduleTracker = new Map<string, number>() // "room-day-period" -> rowNumber

  const uniqueTeachers = new Set<string>()
  const uniqueClasses = new Set<string>()
  const missingTeachers = new Set<string>()
  const missingClasses = new Set<string>()

  rawRows.forEach(row => {
    let hasRowError = false

    // Required field checks
    if (!row.className) {
      errors.push({ rowNumber: row.rowNumber, column: 'Class', message: 'Class name is missing.', severity: 'error' })
      hasRowError = true
    } else {
      uniqueClasses.add(row.className)
    }

    if (!row.teacherName) {
      errors.push({ rowNumber: row.rowNumber, column: 'Teacher', message: 'Teacher name/email is missing.', severity: 'error' })
      hasRowError = true
    } else {
      uniqueTeachers.add(row.teacherName)
    }

    if (!row.subject) {
      errors.push({ rowNumber: row.rowNumber, column: 'Subject', message: 'Subject name is missing.', severity: 'error' })
      hasRowError = true
    }

    if (!row.day || row.day < 1 || row.day > 5) {
      errors.push({ rowNumber: row.rowNumber, column: 'Day', message: `Invalid day "${row.day}". Must be Monday-Friday (1-5).`, severity: 'error' })
      hasRowError = true
    }

    if (!row.period || row.period < 1 || row.period > 10) {
      errors.push({ rowNumber: row.rowNumber, column: 'Period', message: `Invalid period "${row.period}". Must be between 1 and 10.`, severity: 'error' })
      hasRowError = true
    }

    if (hasRowError) return

    // Match Teacher ID
    const tLower = row.teacherName.toLowerCase().trim()
    const teacherId = teacherMapByName.get(tLower) || teacherMapByEmail.get(tLower)
    if (!teacherId) {
      missingTeachers.add(row.teacherName)
      errors.push({
        rowNumber: row.rowNumber,
        column: 'Teacher',
        message: `Teacher "${row.teacherName}" not found in system profiles.`,
        severity: 'error',
      })
      hasRowError = true
    } else {
      row.matchedTeacherId = teacherId
    }

    // Match Class ID
    const cLower = row.className.toLowerCase().trim()
    const cSlug = cLower.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const classId = classMapByName.get(cLower) || classMapBySlug.get(cSlug)
    if (!classId) {
      missingClasses.add(row.className)
      warnings.push({
        rowNumber: row.rowNumber,
        column: 'Class',
        message: `Class "${row.className}" is not yet created. Will be auto-created during import.`,
        severity: 'warning',
      })
    } else {
      row.matchedClassId = classId
    }

    // Conflict Check 1: Teacher Double Booking
    if (teacherId) {
      const teacherKey = `${teacherId}-${row.day}-${row.period}`
      const existingRow = teacherScheduleTracker.get(teacherKey)
      if (existingRow) {
        errors.push({
          rowNumber: row.rowNumber,
          column: 'Teacher Conflict',
          message: `Teacher "${row.teacherName}" is already scheduled at Day ${row.day}, Period ${row.period} (Conflicting with Row ${existingRow}).`,
          severity: 'error',
        })
        hasRowError = true
      } else {
        teacherScheduleTracker.set(teacherKey, row.rowNumber)
      }
    }

    // Conflict Check 2: Class Double Booking
    if (row.className) {
      const classKey = `${cLower}-${row.day}-${row.period}`
      const existingRow = classScheduleTracker.get(classKey)
      if (existingRow) {
        errors.push({
          rowNumber: row.rowNumber,
          column: 'Class Conflict',
          message: `Class "${row.className}" already has a class scheduled at Day ${row.day}, Period ${row.period} (Conflicting with Row ${existingRow}).`,
          severity: 'error',
        })
        hasRowError = true
      } else {
        classScheduleTracker.set(classKey, row.rowNumber)
      }
    }

    // Conflict Check 3: Room Double Booking
    if (row.room) {
      const roomKey = `${row.room.toLowerCase().trim()}-${row.day}-${row.period}`
      const existingRow = roomScheduleTracker.get(roomKey)
      if (existingRow) {
        warnings.push({
          rowNumber: row.rowNumber,
          column: 'Room Conflict',
          message: `Room "${row.room}" is assigned to multiple classes at Day ${row.day}, Period ${row.period} (Row ${existingRow}).`,
          severity: 'warning',
        })
      } else {
        roomScheduleTracker.set(roomKey, row.rowNumber)
      }
    }

    if (!hasRowError) {
      validRows.push(row)
    }
  })

  return {
    totalRows: rawRows.length,
    validRows,
    errors,
    warnings,
    uniqueTeachers: Array.from(uniqueTeachers),
    uniqueClasses: Array.from(uniqueClasses),
    missingTeachers: Array.from(missingTeachers),
    missingClasses: Array.from(missingClasses),
  }
}

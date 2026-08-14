import { parseISO, format } from 'date-fns'

export type EventType =
  | 'special_closure'
  | 'working_day_override'
  | 'school_holiday'
  | 'exam_day'
  | 'teacher_training_day'
  | 'public_holiday'

export type EventSource = 'api_sync' | 'manual' | 'admin'

export interface SchoolCalendarEvent {
  id?: string
  school_id: string
  event_date: string // YYYY-MM-DD
  title: string
  description?: string | null
  event_type: EventType
  source: EventSource
  is_working_day: boolean
  external_id?: string | null
  synced_at?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
}

export interface SchoolSettings {
  id: string
  school_id: string
  absence_buffer_hours: number // e.g. 2
  absence_cutoff_hours_before_deprecated?: number
  absence_cutoff_time_deprecated?: string
  working_days: string[] // e.g. ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  allow_emergency_absence: boolean
  auto_sync_holidays: boolean
  timezone: string // "Asia/Colombo"
  last_holiday_sync_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface CalendarReason {
  isAvailable: boolean
  reason: string
  priorityLevel: number
  event?: SchoolCalendarEvent | null
  suggestion?: string
}

export interface AbsenceDefaultResult {
  date: string
  isNextDaySuggested: boolean
  reason: string
  isPastCutoff: boolean
}

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  id: 'default',
  school_id: 'default',
  absence_buffer_hours: 2,
  working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  allow_emergency_absence: true,
  auto_sync_holidays: true,
  timezone: 'Asia/Colombo',
}

const DAY_NAME_MAP: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

/** Get day of week string in Sri Lanka time ("Monday" … "Sunday") */
export function getSLTDayName(dateStr: string): string {
  try {
    const d = parseISO(dateStr + 'T00:00:00')
    return DAY_NAME_MAP[d.getDay()] || 'Monday'
  } catch {
    return 'Monday'
  }
}

/** Format current time in Asia/Colombo as HH:MM */
export function getCurrentSLTTime(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Colombo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date())

    const hour = parts.find(p => p.type === 'hour')?.value || '00'
    const minute = parts.find(p => p.type === 'minute')?.value || '00'
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  } catch {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  }
}

/** Format current date in Asia/Colombo as YYYY-MM-DD */
export function getCurrentSLTDate(): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

/**
 * Resolves calendar status and availability for a specific date using conflict priority rules:
 * Priority 1: Emergency School Closure (special_closure) -> Closed
 * Priority 2: Admin Working Day Override (working_day_override) -> Working Day
 * Priority 3: Attendance Finalized -> Unavailable for standard new requests
 * Priority 4: School Holiday / Exam Day / Teacher Training Day -> Closed
 * Priority 5: Public Holiday / Poya Day -> Closed
 * Priority 6: Weekend Rule -> Closed if day not in school_settings.working_days
 */
export function getCalendarReason(
  dateStr: string,
  events: SchoolCalendarEvent[],
  settings: SchoolSettings = DEFAULT_SCHOOL_SETTINGS,
  isAttendanceFinalized: boolean = false
): CalendarReason {
  const dateEvents = events.filter(e => e.event_date === dateStr)

  // Priority 1: Emergency School Closure
  const emergencyClosure = dateEvents.find(e => e.event_type === 'special_closure')
  if (emergencyClosure) {
    return {
      isAvailable: false,
      reason: `Emergency Closure: ${emergencyClosure.title}`,
      priorityLevel: 1,
      event: emergencyClosure,
    }
  }

  // Priority 2: Admin Manual Working Day Override
  const workingOverride = dateEvents.find(e => e.event_type === 'working_day_override' || e.is_working_day)
  if (workingOverride) {
    return {
      isAvailable: true,
      reason: `Working Day Override: ${workingOverride.title}`,
      priorityLevel: 2,
      event: workingOverride,
    }
  }

  // Priority 3: Attendance Finalized
  if (isAttendanceFinalized && dateStr === getCurrentSLTDate()) {
    return {
      isAvailable: false,
      reason: 'Attendance for today has already been finalized.',
      priorityLevel: 3,
      event: null,
    }
  }

  // Priority 4: School Holiday / Exam Day / Teacher Training Day
  const schoolHoliday = dateEvents.find(e =>
    ['school_holiday', 'exam_day', 'teacher_training_day'].includes(e.event_type) && !e.is_working_day
  )
  if (schoolHoliday) {
    return {
      isAvailable: false,
      reason: `${schoolHoliday.title} (${schoolHoliday.event_type.replace('_', ' ')})`,
      priorityLevel: 4,
      event: schoolHoliday,
    }
  }

  // Priority 5: Public Holiday / Poya Day
  const publicHoliday = dateEvents.find(e => e.event_type === 'public_holiday' && !e.is_working_day)
  if (publicHoliday) {
    return {
      isAvailable: false,
      reason: `Public Holiday: ${publicHoliday.title}`,
      priorityLevel: 5,
      event: publicHoliday,
    }
  }

  // Priority 6: Default Weekend / Working Days check
  const dayName = getSLTDayName(dateStr)
  const workingDays = settings.working_days || DEFAULT_SCHOOL_SETTINGS.working_days
  if (!workingDays.includes(dayName)) {
    return {
      isAvailable: false,
      reason: `Weekend / Non-working day (${dayName})`,
      priorityLevel: 6,
      event: null,
    }
  }

  // Available working day
  return {
    isAvailable: true,
    reason: 'School Working Day',
    priorityLevel: 7,
    event: null,
  }
}

/** Check if a date is a valid school working day */
export function isSchoolWorkingDay(
  dateStr: string,
  events: SchoolCalendarEvent[],
  settings: SchoolSettings = DEFAULT_SCHOOL_SETTINGS
): boolean {
  return getCalendarReason(dateStr, events, settings, false).isAvailable
}

/**
 * Returns the next available school working day starting after `startDateStr` (or `startDateStr` if `includeStart` is true).
 * Automatically skips weekends, public holidays, Poya days, and special closures.
 */
export function getNextWorkingSchoolDay(
  startDateStr: string,
  events: SchoolCalendarEvent[],
  settings: SchoolSettings = DEFAULT_SCHOOL_SETTINGS,
  includeStart: boolean = false
): string {
  let cursor = parseISO(startDateStr + 'T00:00:00')
  if (!includeStart) {
    cursor.setDate(cursor.getDate() + 1)
  }

  let safetyCount = 0
  while (safetyCount < 365) {
    const yyyy = cursor.getFullYear()
    const mm = String(cursor.getMonth() + 1).padStart(2, '0')
    const dd = String(cursor.getDate()).padStart(2, '0')
    const dateCandidate = `${yyyy}-${mm}-${dd}`

    if (isSchoolWorkingDay(dateCandidate, events, settings)) {
      return dateCandidate
    }

    cursor.setDate(cursor.getDate() + 1)
    safetyCount++
  }

  return startDateStr
}

/**
 * Determines the default absence date and contextual user message based on:
 * - Current Sri Lanka time vs relative cutoff hours
 * - Working day availability
 * - Attendance finalization status
 */
export function getDefaultAbsenceDate(
  events: SchoolCalendarEvent[],
  settings: SchoolSettings = DEFAULT_SCHOOL_SETTINGS,
  isAttendanceFinalized: boolean = false,
  timetableStart: string = '07:50',
  timetableEnd: string = '13:30'
): AbsenceDefaultResult {
  const today = getCurrentSLTDate()
  const bufferHours = settings.absence_buffer_hours ?? 2

  // Cutoff for today is today's end_time + bufferHours
  const todayEndCutoff = new Date(`${today}T${timetableEnd}:00+05:30`)
  todayEndCutoff.setHours(todayEndCutoff.getHours() + bufferHours)

  const currentSLT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' }))
  const isPastCutoff = currentSLT >= todayEndCutoff

  const todayStatus = getCalendarReason(today, events, settings, isAttendanceFinalized)

  // If today is past cutoff time
  if (isPastCutoff) {
    const nextWorkingDay = getNextWorkingSchoolDay(today, events, settings, false)
    return {
      date: nextWorkingDay,
      isNextDaySuggested: true,
      reason: `Today's school day is over (past ${timetableEnd} + ${bufferHours}h buffer). New requests default to the next working school day (${nextWorkingDay}).`,
      isPastCutoff: true,
    }
  }

  // If today is NOT a working day (weekend, public holiday, closure) or attendance is finalized
  if (!todayStatus.isAvailable) {
    const nextWorkingDay = getNextWorkingSchoolDay(today, events, settings, false)
    return {
      date: nextWorkingDay,
      isNextDaySuggested: true,
      reason: `${todayStatus.reason}. New absence requests apply to the next working school day (${nextWorkingDay}).`,
      isPastCutoff: false,
    }
  }

  // Today is an available working day before cutoff time
  return {
    date: today,
    isNextDaySuggested: false,
    reason: 'Today is an active school working day.',
    isPastCutoff: false,
  }
}

/** Returns the minimum allowed selectable date for absence requests */
export function getMinimumSelectableDate(
  events: SchoolCalendarEvent[],
  settings: SchoolSettings = DEFAULT_SCHOOL_SETTINGS,
  timetableStart: string = '07:50',
  timetableEnd: string = '13:30'
): string {
  return getEffectiveMinimumAbsenceDate(settings, timetableStart, timetableEnd)
}

/**
 * Computes the "effective minimum absence date" for non-admin submissions.
 */
export function getEffectiveMinimumAbsenceDate(
  settings: SchoolSettings = DEFAULT_SCHOOL_SETTINGS,
  timetableStart: string = '07:50',
  timetableEnd: string = '13:30'
): string {
  const todayStr = getCurrentSLTDate()
  const bufferHours = settings.absence_buffer_hours ?? 2
  
  // Cutoff for today: today's end_time + bufferHours
  const todayEndCutoff = new Date(`${todayStr}T${timetableEnd}:00+05:30`)
  todayEndCutoff.setHours(todayEndCutoff.getHours() + bufferHours)
  
  const currentSLT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' }))
  const isPastCutoffToday = currentSLT >= todayEndCutoff

  const d = parseISO(todayStr + 'T00:00:00')
  const dow = d.getDay() // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

  let daysToAdd = 0

  if (!isPastCutoffToday) {
    if (dow === 6) daysToAdd = 2 // Sat -> Mon
    else if (dow === 0) daysToAdd = 1 // Sun -> Mon
    else daysToAdd = 0 // Mon-Fri -> Today
  } else {
    if (dow >= 1 && dow <= 4) daysToAdd = 1 // Mon-Thu -> Tomorrow
    else if (dow === 5) daysToAdd = 3 // Fri -> Mon
    else if (dow === 6) daysToAdd = 2 // Sat -> Mon
    else if (dow === 0) daysToAdd = 1 // Sun -> Mon
  }

  const targetDate = new Date(d)
  targetDate.setDate(targetDate.getDate() + daysToAdd)

  const yyyy = targetDate.getFullYear()
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0')
  const dd = String(targetDate.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}


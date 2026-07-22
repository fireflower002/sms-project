import { format, parseISO } from 'date-fns'

export const DAY_NAMES: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
}

export const SHORT_DAY_NAMES: Record<number, string> = {
  1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri',
}

/** Return today's date as YYYY-MM-DD in Sri Lanka time */
export function todaySLT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}

/** Return today's day of week (1=Mon … 5=Fri), or 1 if weekend */
export function todayDayOfWeek(): number {
  const d = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Colombo', weekday: 'long' })
  const map: Record<string, number> = { Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5 }
  return map[d] ?? 1
}

/** Return day of week (1=Mon … 5=Fri) for a YYYY-MM-DD string, or 1 if weekend */
export function dateToDayOfWeek(dateStr: string): number {
  try {
    const d = parseISO(dateStr + 'T00:00:00')
    const day = d.getDay() // 0 = Sun, 1 = Mon ... 6 = Sat
    if (day >= 1 && day <= 5) return day
    return 1
  } catch {
    return 1
  }
}

/** Format a date string or ISO timestamp */
export function formatSLT(value: string, fmt: string): string {
  try {
    const d = value.includes('T') ? parseISO(value) : parseISO(value + 'T00:00:00')
    return format(d, fmt)
  } catch {
    return value
  }
}

/** Convert "HH:MM" to display like "7:30 AM" */
export function formatTime(t: string): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr), m = parseInt(mStr)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hh = h % 12 || 12
  return `${hh}:${String(m).padStart(2,'0')} ${ampm}`
}

/** Convert "HH:MM" to total minutes */
function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Convert total minutes to "HH:MM" */
function fromMins(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

export interface Break {
  after_period: number
  duration: number
  label: string
}

export interface Period {
  period_number: number
  start_time: string
  end_time: string
  is_break: boolean
  break_label?: string
}

/** Generate all periods (and breaks) from template settings */
export function generatePeriods(
  startTime: string,
  endTime: string,
  periodDuration: number,
  breaks: Break[] = []
): Period[] {
  if (!startTime || !endTime || !periodDuration) return []

  const result: Period[] = []
  let cursor = toMins(startTime)
  const end = toMins(endTime)
  let periodNum = 1

  const breakMap: Record<number, Break> = {}
  breaks.forEach(b => { breakMap[b.after_period] = b })

  while (cursor < end) {
    const periodEnd = cursor + periodDuration
    if (periodEnd > end) break

    result.push({
      period_number: periodNum,
      start_time: fromMins(cursor),
      end_time: fromMins(periodEnd),
      is_break: false,
    })

    // Insert break after this period if configured
    if (breakMap[periodNum]) {
      const brk = breakMap[periodNum]
      result.push({
        period_number: periodNum,
        start_time: fromMins(periodEnd),
        end_time: fromMins(periodEnd + brk.duration),
        is_break: true,
        break_label: brk.label,
      })
      cursor = periodEnd + brk.duration
    } else {
      cursor = periodEnd
    }

    periodNum++
  }

  return result
}

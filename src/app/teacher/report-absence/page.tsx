'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2, AlertCircle, Calendar, Sun, Moon, Sparkles, ClipboardList, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { todaySLT, generatePeriods } from '@/lib/utils'
import { H } from '@/lib/honey'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const styles: { [key: string]: React.CSSProperties } = {
  page: { backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 32px)', fontFamily: H.font },
  container: { maxWidth: '600px', margin: '0 auto' },
  pageHeader: { textAlign: 'center', marginBottom: '32px' },
  pageTitle: { fontSize: '24px', fontWeight: 800, color: H.textPrimary, margin: 0 },
  pageSubtitle: { fontSize: '14px', color: H.textSec, marginTop: '4px', margin: '4px 0 0' },
  card: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' },
  button: { border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px', padding: '12px 24px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', minHeight: '44px' },
  buttonPrimary: { background: '#18181B', color: '#FFFFFF' },
  label: { display: 'block', fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' },
}

const inputStyle = (isFocused: boolean): React.CSSProperties => ({
  width: '100%', padding: '12px 16px', borderRadius: '10px',
  border: `2px solid ${isFocused ? '#18181B' : H.border}`,
  background: H.bg, color: H.textPrimary, fontFamily: H.font,
  fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const,
  transition: 'border-color 0.2s ease', minHeight: '44px',
})

const ABSENCE_TYPES = [
  { value: 'full_day', label: 'Full Day', desc: 'Absent the entire day', icon: <Moon size={20} /> },
  { value: 'morning_block', label: 'Morning Block', desc: 'Absent in the morning only', icon: <Sun size={20} /> },
  { value: 'afternoon_block', label: 'Afternoon Block', desc: 'Absent in the afternoon only', icon: <Sun size={20} /> },
  { value: 'custom_periods', label: 'Specific Periods', desc: 'Choose which periods to miss', icon: <Sparkles size={20} /> },
]

import {
  SchoolCalendarEvent,
  SchoolSettings,
  DEFAULT_SCHOOL_SETTINGS,
  getDefaultAbsenceDate,
  getCalendarReason,
  getCurrentSLTDate,
  getCurrentSLTTime,
  getEffectiveMinimumAbsenceDate,
} from '@/lib/calendarService'

export default function ReportAbsencePage() {
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelSuccess, setCancelSuccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [isLateSubmitted, setIsLateSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [template, setTemplate] = useState<any>(null)
  const [alreadyExists, setAlreadyExists] = useState(false)
  const [existingAbsence, setExistingAbsence] = useState<any>(null)

  const [events, setEvents] = useState<SchoolCalendarEvent[]>([])
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS)
  const [isEmergency, setIsEmergency] = useState(false)
  const [dateReason, setDateReason] = useState<any>(null)

  const [form, setForm] = useState({
    absence_date: todaySLT(),
    absence_type: 'full_day',
    reason: '',
    custom_periods: [] as number[],
  })
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/teacher/login'); return }

      const [{ data: tmpl }, { data: existing }, { data: calEvents }, { data: schoolSets }] = await Promise.all([
        supabase.from('timetable_templates').select('*').eq('is_active', true).maybeSingle(),
        supabase.from('absences').select('*').eq('teacher_id', user.id).eq('absence_date', todaySLT()).maybeSingle(),
        supabase.from('school_calendar_events').select('*'),
        supabase.from('school_settings').select('*').eq('school_id', 'default').maybeSingle(),
      ])

      const currentEvents = calEvents || []
      const currentSets = schoolSets || DEFAULT_SCHOOL_SETTINGS
      setEvents(currentEvents)
      setSettings(currentSets)

      const defResult = getDefaultAbsenceDate(currentEvents, currentSets, false, tmpl?.start_time || '07:50', tmpl?.end_time || '13:30')
      setForm(f => ({ ...f, absence_date: defResult.date }))
      setDateReason(defResult)

      setTemplate(tmpl || null)
      setExistingAbsence(existing || null)
      setAlreadyExists(!!existing)
      setLoading(false)
    }
    load()
  }, [router, supabase])

  // Update date reason when selected date changes
  useEffect(() => {
    if (events.length > 0 || settings) {
      const reasonObj = getCalendarReason(form.absence_date, events, settings)
      setDateReason(reasonObj)
    }
  }, [form.absence_date, events, settings])

  const handleCancelAbsence = async () => {
    if (!existingAbsence?.id) return
    setCancelling(true)
    setError('')

    try {
      const res = await fetch('/api/teacher/cancel-absence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ absenceId: existingAbsence.id }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to cancel absence record.')
      }

      setAlreadyExists(false)
      setExistingAbsence(null)
      setCancelSuccess(true)
      setTimeout(() => setCancelSuccess(false), 5000)
    } catch (err: any) {
      console.error('[handleCancelAbsence] Error:', err)
      setError('Could not cancel absence notice. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  const periods = template ? generatePeriods(template.start_time, template.end_time, template.period_duration, template.breaks || []).filter((p: any) => !p.is_break) : []
  const togglePeriod = (n: number) => setForm(f => ({ ...f, custom_periods: f.custom_periods.includes(n) ? f.custom_periods.filter(x => x !== n) : [...f.custom_periods, n] }))

  const minDate = getEffectiveMinimumAbsenceDate(settings, template?.start_time || '07:50', template?.end_time || '13:30')
  const maxDateObj = new Date()
  maxDateObj.setDate(maxDateObj.getDate() + 30)
  const maxDate = maxDateObj.toISOString().split('T')[0]

  const today = getCurrentSLTDate()
  const isTodaySelected = form.absence_date === today
  const isPastCutoff = dateReason?.isPastCutoff || false

  const isLessThan2HoursBeforeStart = template?.start_time ? (() => {
    const currentSLT = new Date(`${getCurrentSLTDate()}T${getCurrentSLTTime()}:00+05:30`)
    const targetSLT = new Date(`${form.absence_date}T${template.start_time}:00+05:30`)
    const diffMs = targetSLT.getTime() - currentSLT.getTime()
    const bufferMs = (settings.absence_buffer_hours ?? 2) * 60 * 60 * 1000
    return form.absence_date >= today && diffMs < bufferMs
  })() : false

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    // Reject past dates outright
    if (form.absence_date < today) {
      setError("You cannot submit an absence for a past date")
      setSubmitting(false)
      return
    }

    // Calendar & Cutoff Validation
    const calendarCheck = getCalendarReason(form.absence_date, events, settings)
    if (!calendarCheck.isAvailable && (!isTodaySelected || !isEmergency)) {
      setError(`Cannot submit absence: ${calendarCheck.reason}`)
      setSubmitting(false)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setError('Not authenticated'); setSubmitting(false); return }

    const { data: existingOnDate } = await supabase
      .from('absences')
      .select('id')
      .eq('teacher_id', user.id)
      .eq('absence_date', form.absence_date)
      .maybeSingle()

    if (existingOnDate) {
      setError(`You already have an absence recorded for ${form.absence_date}.`)
      setSubmitting(false)
      return
    }

    if (!template || !template.id) {
      setError('No active timetable template found — contact admin.')
      setSubmitting(false)
      return
    }

    const isLate = isLessThan2HoursBeforeStart || (isTodaySelected && isEmergency)

    const payload: any = {
      teacher_id: user.id,
      absence_date: form.absence_date,
      absence_type: form.absence_type,
      reason: form.reason || null,
      status: isLate ? 'late_submission' : 'pending',
      template_id: template.id,
    }
    if (form.absence_type === 'custom_periods') payload.custom_periods = form.custom_periods

    const { error: err } = await supabase.from('absences').insert(payload)
    if (err) {
      console.error('[handleSubmit] Insert absence error:', err.message)
      setError('Could not submit absence notice. Please check your entries and try again.')
    } else {
      if (isLate) {
        setIsLateSubmitted(true)
      }
      setDone(true)
    }
    setSubmitting(false)
  }


  if (loading) return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: H.font }}>
      <LoadingSpinner size={32} color={H.skyBlue} />
    </div>
  )

  if (done) return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: H.font, padding: '24px' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, padding: '40px', textAlign: 'center', maxWidth: '480px', width: '100%' }}>
        <CheckCircle2 size={52} style={{ color: H.grass, margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: H.textPrimary, margin: '0 0 8px' }}>Absence Reported</h2>
        {isLateSubmitted ? (
          <p style={{ fontSize: '14px', color: H.danger, fontWeight: 600, margin: '0 0 24px' }}>
            This is a late submission — please also contact admin directly to arrange cover, as it may not be reviewed in time.
          </p>
        ) : (
          <p style={{ fontSize: '14px', color: H.textSec, margin: '0 0 24px' }}>The school administration has been notified. Cover will be arranged if necessary.</p>
        )}
        <Link href="/teacher" style={{ ...styles.button, ...styles.buttonPrimary }}>Back to Dashboard</Link>
      </div>
    </div>
  )

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box', paddingBottom: '96px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' }}>

          {/* Contiguous Header Bar */}
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: H.surface }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={20} style={{ color: '#18181B' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>Report an Absence</h1>
              <p style={{ fontSize: '13px', color: H.textSec, margin: '4px 0 0' }}>Notify administration of your absence</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {alreadyExists && (
              <div style={{
                padding: '16px 24px',
                background: H.accentLight,
                color: H.accentDark,
                borderBottom: `1px solid ${H.accent}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600 }}>
                  <AlertCircle size={18} style={{ color: H.accentDark, flexShrink: 0 }} />
                  <span>You already have an absence recorded for today.</span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelAbsence}
                  disabled={cancelling}
                  style={{
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: cancelling ? 0.7 : 1,
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cancelling ? (
                    <>
                      <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Cancelling...
                    </>
                  ) : (
                    <>
                      <XCircle size={14} /> Cancel Today's Absence
                    </>
                  )}
                </button>
              </div>
            )}
            {cancelSuccess && (
              <div style={{ padding: '14px 24px', background: H.successLight, color: '#065F46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', borderBottom: `1px solid ${H.grass}40` }}>
                <CheckCircle2 size={16} /> Today's absence record has been cancelled. You can now submit a new report.
              </div>
            )}
            {error && <div style={{ padding: '14px 24px', background: H.dangerLight, color: H.danger, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', borderBottom: `1px solid ${H.danger}40` }}><AlertCircle size={16} />{error}</div>}

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <label style={styles.label}><Calendar size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Absence Date <span style={{ color: '#DC2626' }}>*</span></label>
                <input type="date" min={minDate} max={maxDate} value={form.absence_date} onChange={e => setForm(f => ({ ...f, absence_date: e.target.value }))} style={inputStyle(focusedField === 'date')} onFocus={() => setFocusedField('date')} onBlur={() => setFocusedField(null)} required />
                
                {dateReason && (
                  <div style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '8px', backgroundColor: dateReason.isAvailable ? H.skyLight : '#FEF2F2', border: `1px solid ${dateReason.isAvailable ? H.skyBlue : '#FCA5A5'}`, fontSize: '12px', color: dateReason.isAvailable ? H.skyDark : '#991B1B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>{dateReason.reason || (dateReason.isAvailable ? 'Valid school working day' : 'Selected date is unavailable')}</span>
                  </div>
                )}

                {isTodaySelected && isPastCutoff && settings.allow_emergency_absence && (
                  <div style={{ marginTop: '10px', padding: '12px', borderRadius: '8px', backgroundColor: '#FEF3C7', border: `1px solid #FCD34D`, fontSize: '13px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#B45309', cursor: 'pointer' }}>
                      <input type="checkbox" checked={isEmergency} onChange={e => setIsEmergency(e.target.checked)} />
                      Emergency Absence (Late Submission)
                    </label>
                    <div style={{ fontSize: '11px', color: H.textSec, marginTop: '4px', paddingLeft: '24px' }}>
                      Buffer window ({settings.absence_buffer_hours ?? 2} hours before school day start) has passed. Checking this will tag your submission for immediate admin review.
                    </div>
                  </div>
                )}

                {isLessThan2HoursBeforeStart && (
                  <div style={{ marginTop: '10px', padding: '12px', borderRadius: '8px', backgroundColor: '#FEF2F2', border: `1px solid ${H.danger}`, fontSize: '13px', color: '#991B1B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>This is a late submission — please also contact admin directly to arrange cover, as it may not be reviewed in time.</span>
                  </div>
                )}
              </div>

              <div>
                <label style={styles.label}>Absence Type <span style={{ color: '#DC2626' }}>*</span></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {ABSENCE_TYPES.map(t => (
                    <label key={t.value} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '12px', border: `2px solid ${form.absence_type === t.value ? '#18181B' : H.border}`, background: form.absence_type === t.value ? '#F4F4F5' : H.surface, cursor: 'pointer', transition: 'all 0.15s ease' }}>
                      <input type="radio" name="type" value={t.value} checked={form.absence_type === t.value} onChange={() => setForm(f => ({ ...f, absence_type: t.value }))} style={{ display: 'none' }} />
                      <div style={{ color: form.absence_type === t.value ? '#18181B' : H.textSec }}>{t.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: form.absence_type === t.value ? '#18181B' : H.textPrimary }}>{t.label}</div>
                        <div style={{ fontSize: '12px', color: form.absence_type === t.value ? H.textSec : H.textSec }}>{t.desc}</div>
                      </div>
                      {form.absence_type === t.value && <CheckCircle2 size={20} style={{ color: '#18181B' }} />}
                    </label>
                  ))}
                </div>
              </div>

              {form.absence_type === 'custom_periods' && periods.length > 0 && (
                <div>
                  <label style={styles.label}>Select Periods <span style={{ color: '#DC2626' }}>*</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {periods.map((p: any) => (
                      <button key={p.period_number} type="button" onClick={() => togglePeriod(p.period_number)} style={{ ...styles.button, minHeight: '38px', padding: '8px 16px', background: form.custom_periods.includes(p.period_number) ? '#18181B' : H.bg, color: form.custom_periods.includes(p.period_number) ? '#FFFFFF' : H.textPrimary, border: `1px solid ${form.custom_periods.includes(p.period_number) ? '#18181B' : H.border}` }}>P{p.period_number}</button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label style={styles.label}>Reason <span style={{ color: H.textMuted, fontWeight: 400 }}>(optional)</span></label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Sick leave, family emergency..." rows={3} style={{ ...inputStyle(focusedField === 'reason'), resize: 'vertical', minHeight: '80px' }} onFocus={() => setFocusedField('reason')} onBlur={() => setFocusedField(null)} />
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${H.border}`, padding: '16px 24px', background: H.bg, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={submitting || alreadyExists} style={{ ...styles.button, ...styles.buttonPrimary, width: '100%', opacity: (submitting || alreadyExists) ? 0.6 : 1 }}>
                {submitting ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Submit Absence Report'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

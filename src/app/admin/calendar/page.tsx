'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CheckSquare,
  Square,
  List,
  Grid,
  History,
  Info,
} from 'lucide-react'
import { H } from '@/lib/honey'
import { useToast } from '@/components/ui/Toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmModal, { ConfirmModalState } from '@/components/ui/ConfirmModal'
import {
  SchoolCalendarEvent,
  SchoolSettings,
  DEFAULT_SCHOOL_SETTINGS,
  EventType,
} from '@/lib/calendarService'

const EVENT_TYPE_LABELS: Record<EventType, { label: string; color: string; bg: string }> = {
  public_holiday: { label: 'Public Holiday', color: '#DC2626', bg: '#FEF2F2' },
  school_holiday: { label: 'School Holiday', color: '#D97706', bg: '#FEF3C7' },
  working_day_override: { label: 'Working Override', color: '#059669', bg: '#D1FAE5' },
  special_closure: { label: 'Special Closure', color: '#7C3AED', bg: '#F3E8FF' },
  exam_day: { label: 'Exam Day', color: '#2563EB', bg: '#EFF6FF' },
  teacher_training_day: { label: 'Teacher Training', color: '#DB2777', bg: '#FDF2F8' },
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<SchoolCalendarEvent[]>([])
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS)
  const [syncLogs, setSyncLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [viewMode, setViewMode] = useState<'month' | 'list'>('month')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Modals state
  const [showEventModal, setShowEventModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<SchoolCalendarEvent | null>(null)
  const [eventForm, setEventForm] = useState<{
    event_date: string
    title: string
    description: string
    event_type: EventType
    is_working_day: boolean
  }>({
    event_date: new Date().toISOString().split('T')[0],
    title: '',
    description: '',
    event_type: 'school_holiday',
    is_working_day: false,
  })

  const [showLogsModal, setShowLogsModal] = useState(false)
  const [modal, setModal] = useState<ConfirmModalState | null>(null)
  const { showToast } = useToast()
  const supabase = createClient()

  // Load calendar events, settings & sync logs
  const loadData = useCallback(async (isInitial = false) => {
    if (!isInitial) setLoading(true)
    try {
      const [{ data: evs }, { data: sets }, { data: logs }] = await Promise.all([
        supabase.from('school_calendar_events').select('*').order('event_date', { ascending: true }),
        supabase.from('school_settings').select('*').eq('school_id', 'default').maybeSingle(),
        supabase.from('calendar_sync_logs').select('*').order('synced_at', { ascending: false }).limit(20),
      ])

      setEvents(evs || [])
      if (sets) {
        setSettings(sets)
      }
      setSyncLogs(logs || [])
    } catch (err: any) {
      console.error('[AdminCalendarPage] load error:', err)
      showToast('Error loading calendar data', 'error')
    } finally {
      setLoading(false)
    }
  }, [supabase, showToast])

  useEffect(() => {
    loadData(true)
  }, [loadData])

  // Trigger Sri Lanka holiday sync
  const handleSyncHolidays = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/calendar/sync', { method: 'POST' })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed syncing Sri Lanka public holidays.')
      }

      const addedCount = json.data?.recordsAdded ?? json.recordsAdded ?? 0
      showToast(`Holiday sync complete! Added ${addedCount} events.`, 'success')
      loadData()
    } catch (err: any) {
      showToast(err.message || 'Error executing holiday sync', 'error')
    } finally {
      setSyncing(false)
    }
  }

  // Open modal for new event or editing
  const openNewEventModal = (dateStr?: string) => {
    setEditingEvent(null)
    setEventForm({
      event_date: dateStr || new Date().toISOString().split('T')[0],
      title: '',
      description: '',
      event_type: 'school_holiday',
      is_working_day: false,
    })
    setShowEventModal(true)
  }

  const openEditEventModal = (item: SchoolCalendarEvent) => {
    setEditingEvent(item)
    setEventForm({
      event_date: item.event_date,
      title: item.title,
      description: item.description || '',
      event_type: item.event_type,
      is_working_day: item.is_working_day,
    })
    setShowEventModal(true)
  }

  // Save event (Create or Update)
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventForm.title.trim()) {
      showToast('Event title is required', 'error')
      return
    }

    try {
      const payload: any = {
        school_id: 'default',
        event_date: eventForm.event_date,
        title: eventForm.title.trim(),
        description: eventForm.description.trim() || null,
        event_type: eventForm.event_type,
        is_working_day: eventForm.event_type === 'working_day_override' ? true : eventForm.is_working_day,
        source: 'manual',
        updated_at: new Date().toISOString(),
      }

      if (editingEvent?.id) {
        const { error: err } = await supabase
          .from('school_calendar_events')
          .update(payload)
          .eq('id', editingEvent.id)

        if (err) throw err
        showToast('Calendar entry updated', 'success')
      } else {
        const { error: err } = await supabase
          .from('school_calendar_events')
          .insert(payload)

        if (err) throw err
        showToast('New calendar entry added', 'success')
      }

      setShowEventModal(false)
      loadData()
    } catch (err: any) {
      showToast(err.message || 'Error saving calendar entry', 'error')
    }
  }

  // Delete event
  const handleDeleteEvent = (item: SchoolCalendarEvent) => {
    setModal({
      title: 'Delete Calendar Entry',
      message: `Are you sure you want to remove "${item.title}" on ${item.event_date}?`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        const { error: err } = await supabase
          .from('school_calendar_events')
          .delete()
          .eq('id', item.id)

        if (err) {
          showToast(err.message, 'error')
        } else {
          showToast('Calendar entry removed', 'success')
          loadData()
        }
      },
    })
  }

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }
  const nextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  // Filtered events
  const filteredEvents = events.filter(e => {
    const matchesSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.event_date.includes(search) ||
      (e.description && e.description.toLowerCase().includes(search.toLowerCase()))
    const matchesType = typeFilter === 'all' || e.event_type === typeFilter
    return matchesSearch && matchesType
  })

  // Generate Month Grid days
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDayOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Get day of week for 1st of month (0 = Sun ... 6 = Sat -> adjust to 0 = Mon ... 6 = Sun)
  let startDay = firstDayOfMonth.getDay() - 1
  if (startDay === -1) startDay = 6

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  if (loading) {
    return (
      <LoadingSpinner centered size={36} color="#18181B" />
    )
  }

  return (
    <div style={{ padding: 'clamp(16px, 3vw, 32px)', backgroundColor: H.bg, minHeight: '100vh', fontFamily: H.font }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: H.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CalendarIcon size={26} style={{ color: '#18181B' }} />
            School Calendar Management
          </h1>
          <p style={{ fontSize: '14px', color: H.textSec, margin: '4px 0 0' }}>
            Configure Sri Lankan holidays, working day overrides, cutoff rules, and school calendar settings.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleSyncHolidays}
            disabled={syncing}
            style={{
              height: H.targetSizes.buttonMd,
              padding: '0 14px',
              borderRadius: H.radius.lg,
              border: `1px solid ${H.border}`,
              backgroundColor: '#F4F4F5',
              color: '#18181B',
              fontWeight: 600,
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Syncing...' : 'Sync Sri Lankan Holidays'}
          </button>

          <button
            onClick={() => openNewEventModal()}
            style={{
              height: H.targetSizes.buttonMd,
              padding: '0 16px',
              borderRadius: H.radius.lg,
              backgroundColor: '#18181B',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: H.shadows.sm,
            }}
          >
            <Plus size={16} />
            Add Calendar Event
          </button>
        </div>
      </div>

      {/* Sync Status Banner & Controls */}
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.xl, padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: H.textSec }}>
            <CheckCircle2 size={15} style={{ color: H.successGreen }} />
            <strong>Working Days:</strong> {(settings.working_days || []).join(', ')}
          </div>
          <span style={{ color: H.border }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: H.textSec }}>
            <History size={15} style={{ color: H.skyBlue }} />
            <strong>Last Holiday Sync:</strong> {settings.last_holiday_sync_at ? new Date(settings.last_holiday_sync_at).toLocaleString() : 'Never'}
          </div>
        </div>

        <button
          onClick={() => setShowLogsModal(true)}
          style={{ background: 'none', border: 'none', color: H.skyDark, fontSize: '12px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
        >
          View Sync Logs
        </button>
      </div>

      {/* Toolbar Controls */}
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.xl, padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        {/* Month Navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={prevMonth}
            style={{ width: '36px', height: '36px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, background: H.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ChevronLeft size={18} />
          </button>

          <h2 style={{ fontSize: '18px', fontWeight: 800, color: H.textPrimary, minWidth: '160px', textAlign: 'center', margin: 0 }}>
            {monthName}
          </h2>

          <button
            onClick={nextMonth}
            style={{ width: '36px', height: '36px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, background: H.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Filters & View Switcher */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '200px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: H.textMuted }} />
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, fontSize: '13px', backgroundColor: H.surface, color: H.textPrimary, outline: 'none' }}
          >
            <option value="all">All Event Types</option>
            <option value="public_holiday">Public Holiday</option>
            <option value="school_holiday">School Holiday</option>
            <option value="working_day_override">Working Day Override</option>
            <option value="special_closure">Special Closure</option>
            <option value="exam_day">Exam Day</option>
            <option value="teacher_training_day">Teacher Training</option>
          </select>

          <div style={{ display: 'flex', borderRadius: H.radius.md, border: `1px solid ${H.border}`, overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('month')}
              style={{ padding: '8px 12px', background: viewMode === 'month' ? H.accentLight : H.surface, color: viewMode === 'month' ? H.accentDark : H.textSec, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600 }}
            >
              <Grid size={15} /> Month
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{ padding: '8px 12px', background: viewMode === 'list' ? H.accentLight : H.surface, color: viewMode === 'list' ? H.accentDark : H.textSec, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600 }}
            >
              <List size={15} /> List
            </button>
          </div>
        </div>
      </div>

      {/* View Mode Content */}
      {viewMode === 'month' ? (
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.xl, padding: '20px', boxShadow: H.shadows.card }}>
          {/* Weekday Labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px', textAlign: 'center' }}>
            {WEEKDAYS.map((w, i) => (
              <div key={w} style={{ fontSize: '12px', fontWeight: 800, color: i >= 5 ? H.danger : H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {w}
              </div>
            ))}
          </div>

          {/* Month Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
            {/* Empty padding slots before 1st of month */}
            {Array.from({ length: Math.max(0, startDay) }).map((_, i) => (
              <div key={`empty-${i}`} style={{ minHeight: '90px', background: H.bg, borderRadius: H.radius.md, opacity: 0.4 }} />
            ))}

            {/* Days in month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1
              const mmStr = String(month + 1).padStart(2, '0')
              const ddStr = String(dayNum).padStart(2, '0')
              const dateStr = `${year}-${mmStr}-${ddStr}`

              const dayEvents = filteredEvents.filter(e => e.event_date === dateStr)
              const dObj = new Date(year, month, dayNum)
              const dayIndex = dObj.getDay()
              const dayNameFull = WEEKDAYS[dayIndex === 0 ? 6 : dayIndex - 1]
              const isWeekend = !(settings.working_days || DEFAULT_SCHOOL_SETTINGS.working_days).includes(
                dayIndex === 0 ? 'Sunday' : dayIndex === 6 ? 'Saturday' : dayNameFull === 'Mon' ? 'Monday' : dayNameFull === 'Tue' ? 'Tuesday' : dayNameFull === 'Wed' ? 'Wednesday' : dayNameFull === 'Thu' ? 'Thursday' : 'Friday'
              )

              const isToday = dateStr === new Date().toISOString().split('T')[0]

              return (
                <div
                  key={dayNum}
                  onClick={() => openNewEventModal(dateStr)}
                  style={{
                    minHeight: '100px',
                    padding: '8px',
                    borderRadius: H.radius.md,
                    border: `1px solid ${isToday ? H.accent : H.border}`,
                    backgroundColor: isToday ? '#FFFBEB' : isWeekend ? '#FAFAF9' : H.surface,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: isToday ? 800 : 700, color: isToday ? H.accentDark : isWeekend ? H.textMuted : H.textPrimary }}>
                      {dayNum}
                    </span>
                    {isToday && <span style={{ fontSize: '10px', fontWeight: 800, color: H.chocolate, background: H.accentLight, padding: '1px 6px', borderRadius: '99px' }}>Today</span>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', overflow: 'hidden' }}>
                    {dayEvents.map(ev => {
                      const cfg = EVENT_TYPE_LABELS[ev.event_type] || EVENT_TYPE_LABELS.school_holiday
                      return (
                        <div
                          key={ev.id || ev.title}
                          onClick={e => {
                            e.stopPropagation()
                            openEditEventModal(ev)
                          }}
                          title={`${ev.title} (${cfg.label})`}
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: H.radius.xs,
                            backgroundColor: cfg.bg,
                            color: cfg.color,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {ev.title}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* List View Mode */
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.xl, overflow: 'hidden', boxShadow: H.shadows.card }}>
          {filteredEvents.length === 0 ? (
            <EmptyState title="No Calendar Entries Found" description="No matching events or holidays exist for the selected filters." />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: H.bg, borderBottom: `1px solid ${H.border}`, fontSize: '11px', fontWeight: 800, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px' }}>Event Title</th>
                  <th style={{ padding: '12px 16px' }}>Event Type</th>
                  <th style={{ padding: '12px 16px' }}>Working Status</th>
                  <th style={{ padding: '12px 16px' }}>Source</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map(item => {
                  const cfg = EVENT_TYPE_LABELS[item.event_type] || EVENT_TYPE_LABELS.school_holiday
                  return (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${H.border}` }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: H.textPrimary }}>{item.event_date}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: H.textPrimary }}>
                        {item.title}
                        {item.description && <div style={{ fontSize: '12px', color: H.textSec, fontWeight: 400 }}>{item.description}</div>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 8px', borderRadius: '99px', backgroundColor: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: item.is_working_day ? H.successGreen : H.danger }}>
                        {item.is_working_day ? 'Working Day' : 'Non-Working Day'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: H.textMuted, textTransform: 'capitalize' }}>{item.source}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => openEditEventModal(item)}
                            style={{ padding: '6px', borderRadius: H.radius.sm, border: `1px solid ${H.border}`, background: H.bg, color: H.textSec, cursor: 'pointer' }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(item)}
                            style={{ padding: '6px', borderRadius: H.radius.sm, border: `1px solid ${H.dangerLight}`, background: H.dangerLight, color: H.danger, cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add / Edit Event Modal */}
      {showEventModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '480px', backgroundColor: H.surface, borderRadius: H.radius.xl, boxShadow: H.shadows.modal, padding: '24px', border: `1px solid ${H.border}` }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: H.textPrimary, margin: '0 0 16px' }}>
              {editingEvent ? 'Edit Calendar Entry' : 'Add New Calendar Entry'}
            </h3>

            <form onSubmit={handleSaveEvent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: H.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Event Date</label>
                <input
                  type="date"
                  value={eventForm.event_date}
                  onChange={e => setEventForm(f => ({ ...f, event_date: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: H.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Event Title</label>
                <input
                  type="text"
                  placeholder="e.g. Vesak Full Moon Poya Day"
                  value={eventForm.title}
                  onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: H.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Event Type</label>
                <select
                  value={eventForm.event_type}
                  onChange={e => {
                    const val = e.target.value as EventType
                    setEventForm(f => ({
                      ...f,
                      event_type: val,
                      is_working_day: val === 'working_day_override' ? true : f.is_working_day,
                    }))
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, fontSize: '14px', boxSizing: 'border-box' }}
                >
                  <option value="public_holiday">Public Holiday (Sri Lanka)</option>
                  <option value="school_holiday">School Holiday / Vacation</option>
                  <option value="working_day_override">Working Day Override (e.g. Special Saturday)</option>
                  <option value="special_closure">Special Emergency Closure</option>
                  <option value="exam_day">Exam Day</option>
                  <option value="teacher_training_day">Teacher Training Day</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: H.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Description (Optional)</label>
                <textarea
                  placeholder="Additional context or notes..."
                  value={eventForm.description}
                  onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, fontSize: '13px', boxSizing: 'border-box', fontFamily: H.font }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="isWorkingDayCheck"
                  checked={eventForm.is_working_day}
                  onChange={e => setEventForm(f => ({ ...f, is_working_day: e.target.checked }))}
                  disabled={eventForm.event_type === 'working_day_override'}
                />
                <label htmlFor="isWorkingDayCheck" style={{ fontSize: '13px', fontWeight: 600, color: H.textPrimary }}>
                  Treat as Active School Working Day
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  style={{ padding: '10px 16px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, background: H.surface, color: H.textSec, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', borderRadius: H.radius.md, background: H.purple, color: '#FFFFFF', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sync Logs Modal */}
      {showLogsModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '600px', backgroundColor: H.surface, borderRadius: H.radius.xl, boxShadow: H.shadows.modal, padding: '24px', border: `1px solid ${H.border}`, maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: H.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={20} style={{ color: H.skyBlue }} />
              Holiday Sync History & Audit Logs
            </h3>

            {syncLogs.length === 0 ? (
              <p style={{ color: H.textSec, fontSize: '14px' }}>No synchronization logs recorded yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${H.border}`, color: H.textMuted, fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Timestamp</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Added / Updated</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Error Log</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: `1px solid ${H.border}` }}>
                      <td style={{ padding: '8px' }}>{new Date(log.synced_at).toLocaleString()}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '99px', backgroundColor: log.status === 'success' ? '#D1FAE5' : '#FEF2F2', color: log.status === 'success' ? '#059669' : '#DC2626' }}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>+{log.records_added} / ~{log.records_updated}</td>
                      <td style={{ padding: '8px', color: H.danger, fontSize: '12px' }}>{log.error_message || 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setShowLogsModal(false)}
                style={{ padding: '8px 16px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, background: H.surface, color: H.textPrimary, fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!modal} {...(modal ?? { title: '', message: '', onConfirm: () => { } })} onCancel={() => setModal(null)} />
    </div>
  )
}

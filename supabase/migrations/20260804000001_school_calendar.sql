-- ============================================================
-- MIGRATION: 20260804_school_calendar.sql
-- PURPOSE:   Creates Multi-Tenant School Calendar, Settings, Sync Logs, & Audit Trail
-- DATE:      2026-08-04
-- ============================================================

-- ============================================================
-- SECTION 1: DATABASE TABLES
-- ============================================================

-- 1.1 School Calendar Events Table
-- Stores public holidays, school holidays, working day overrides, exams, and closures
CREATE TABLE IF NOT EXISTS school_calendar_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       text        NOT NULL DEFAULT 'default',
  event_date      date        NOT NULL,
  title           text        NOT NULL,
  description     text,
  -- Restricts event types to supported calendar classifications
  event_type      text        NOT NULL CHECK (event_type IN ('public_holiday', 'school_holiday', 'working_day_override', 'special_closure', 'exam_day', 'teacher_training_day')),
  -- Tracks origin of the calendar event
  source          text        NOT NULL DEFAULT 'manual' CHECK (source IN ('api_sync', 'manual', 'admin')),
  -- True if this date overrides standard weekend/holiday closure to act as an active school day
  is_working_day  boolean     NOT NULL DEFAULT false,
  external_id     text,
  synced_at       timestamptz,
  created_by      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Prevents duplicate event types for the same school on the same date
  CONSTRAINT unique_school_event_date_type UNIQUE (school_id, event_date, event_type)
);

-- 1.2 School Settings Table
-- Configures absence cutoff times, working days, and emergency submission rules
CREATE TABLE IF NOT EXISTS school_settings (
  id                      text        PRIMARY KEY DEFAULT 'default',
  school_id               text        NOT NULL UNIQUE DEFAULT 'default',
  -- Daily time (Asia/Colombo) after which non-admin absence submissions apply to the next working day
  absence_cutoff_time     text        NOT NULL DEFAULT '17:00',
  -- Configured active school weekdays
  working_days            text[]      NOT NULL DEFAULT '{"Monday","Tuesday","Wednesday","Thursday","Friday"}',
  -- Controls whether teachers can check "Emergency Absence" after cutoff time
  allow_emergency_absence boolean     NOT NULL DEFAULT true,
  -- Enables automated holiday sync from national API
  auto_sync_holidays      boolean     NOT NULL DEFAULT true,
  timezone                text        NOT NULL DEFAULT 'Asia/Colombo',
  last_holiday_sync_at    timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- 1.3 Calendar Sync Logs Table
-- Logs automated and manual holiday sync results from external APIs
CREATE TABLE IF NOT EXISTS calendar_sync_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       text        NOT NULL DEFAULT 'default',
  synced_at       timestamptz NOT NULL DEFAULT now(),
  status          text        NOT NULL CHECK (status IN ('success', 'failed')),
  records_added   integer     DEFAULT 0,
  records_updated integer     DEFAULT 0,
  error_message   text,
  created_by      uuid        REFERENCES profiles(id) ON DELETE SET NULL
);

-- 1.4 Calendar Audit Logs Table
-- Audit trail tracking creation, edits, and deletions of calendar entries
CREATE TABLE IF NOT EXISTS calendar_audit_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       text        NOT NULL DEFAULT 'default',
  event_id        uuid        REFERENCES school_calendar_events(id) ON DELETE SET NULL,
  action          text        NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'synced')),
  changed_by      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  old_value       jsonb,
  new_value       jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 2: SEED DATA
-- ============================================================

-- Seeds the initial default configuration row for school_settings
INSERT INTO school_settings (id, school_id, absence_cutoff_time, working_days, allow_emergency_absence, auto_sync_holidays, timezone)
VALUES ('default', 'default', '17:00', '{"Monday","Tuesday","Wednesday","Thursday","Friday"}', true, true, 'Asia/Colombo')
ON CONFLICT (school_id) DO NOTHING;

-- ============================================================
-- SECTION 3: PERFORMANCE INDEXES
-- ============================================================

-- Fast lookup for events by date range and type
CREATE INDEX IF NOT EXISTS idx_calendar_school_date ON school_calendar_events(school_id, event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_school_type ON school_calendar_events(school_id, event_type);

-- Query optimization for sync and audit log history
CREATE INDEX IF NOT EXISTS idx_sync_logs_school  ON calendar_sync_logs(school_id, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_school ON calendar_audit_logs(school_id, created_at DESC);

-- ============================================================
-- SECTION 4: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

ALTER TABLE school_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_audit_logs    ENABLE ROW LEVEL SECURITY;

-- --- 4.1 school_calendar_events Policies ---
DROP POLICY IF EXISTS "cal_events_select" ON school_calendar_events;
DROP POLICY IF EXISTS "cal_events_insert" ON school_calendar_events;
DROP POLICY IF EXISTS "cal_events_update" ON school_calendar_events;
DROP POLICY IF EXISTS "cal_events_delete" ON school_calendar_events;

-- Authenticated teachers and admins can view calendar events
CREATE POLICY "cal_events_select" ON school_calendar_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can manage calendar entries
CREATE POLICY "cal_events_insert" ON school_calendar_events
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "cal_events_update" ON school_calendar_events
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "cal_events_delete" ON school_calendar_events
  FOR DELETE USING (public.is_admin());

-- --- 4.2 school_settings Policies ---
DROP POLICY IF EXISTS "school_settings_select" ON school_settings;
DROP POLICY IF EXISTS "school_settings_insert" ON school_settings;
DROP POLICY IF EXISTS "school_settings_update" ON school_settings;

-- All authenticated users can read cutoff and working day settings
CREATE POLICY "school_settings_select" ON school_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can update school settings
CREATE POLICY "school_settings_insert" ON school_settings
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "school_settings_update" ON school_settings
  FOR UPDATE USING (public.is_admin());

-- --- 4.3 calendar_sync_logs Policies ---
DROP POLICY IF EXISTS "sync_logs_select" ON calendar_sync_logs;
DROP POLICY IF EXISTS "sync_logs_insert" ON calendar_sync_logs;

CREATE POLICY "sync_logs_select" ON calendar_sync_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "sync_logs_insert" ON calendar_sync_logs
  FOR INSERT WITH CHECK (public.is_admin());

-- --- 4.4 calendar_audit_logs Policies ---
DROP POLICY IF EXISTS "audit_logs_select" ON calendar_audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON calendar_audit_logs;

CREATE POLICY "audit_logs_select" ON calendar_audit_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "audit_logs_insert" ON calendar_audit_logs
  FOR INSERT WITH CHECK (public.is_admin());

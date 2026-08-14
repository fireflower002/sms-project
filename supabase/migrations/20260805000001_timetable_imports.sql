-- ============================================================
-- MIGRATION: 20260805_timetable_imports.sql
-- Academic Year Support, Import Batches, Backup Archiving & RLS
-- ============================================================

-- ROLLBACK SQL INSTRUCTIONS:
-- DROP TABLE IF EXISTS timetable_imports CASCADE;
-- ALTER TABLE schedule_assignments DROP COLUMN IF EXISTS school_id, DROP COLUMN IF EXISTS academic_year, DROP COLUMN IF EXISTS import_batch_id, DROP COLUMN IF EXISTS room, DROP COLUMN IF EXISTS is_archived;
-- ALTER TABLE timetable_templates DROP COLUMN IF EXISTS school_id, DROP COLUMN IF EXISTS academic_year, DROP COLUMN IF EXISTS import_batch_id, DROP COLUMN IF EXISTS is_archived, DROP COLUMN IF EXISTS uploaded_by, DROP COLUMN IF EXISTS uploaded_at;

-- 1. ALTER EXISTING TABLES
ALTER TABLE timetable_templates 
  ADD COLUMN IF NOT EXISTS school_id text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS academic_year text NOT NULL DEFAULT '2026',
  ADD COLUMN IF NOT EXISTS import_batch_id uuid,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS uploaded_at timestamptz;

ALTER TABLE schedule_assignments 
  ADD COLUMN IF NOT EXISTS school_id text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS academic_year text NOT NULL DEFAULT '2026',
  ADD COLUMN IF NOT EXISTS import_batch_id uuid,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS room text;

-- 2. CREATE TIMETABLE IMPORTS TRACKING TABLE
CREATE TABLE IF NOT EXISTS timetable_imports (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       text        NOT NULL DEFAULT 'default',
  template_id     uuid        REFERENCES timetable_templates(id) ON DELETE CASCADE,
  academic_year   text        NOT NULL,
  file_name       text        NOT NULL,
  file_size_bytes integer     DEFAULT 0,
  status          text        NOT NULL CHECK (status IN ('processing', 'completed', 'failed', 'rolled_back', 'archived')),
  total_rows      integer     DEFAULT 0,
  successful_rows integer     DEFAULT 0,
  failed_rows     integer     DEFAULT 0,
  error_log       jsonb       DEFAULT '[]'::jsonb,
  imported_by     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- INDEXES FOR HIGH-PERFORMANCE QUERYING
CREATE INDEX IF NOT EXISTS idx_tt_templates_school_year ON timetable_templates(school_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_school_year ON schedule_assignments(school_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_batch ON schedule_assignments(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_timetable_imports_school ON timetable_imports(school_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

ALTER TABLE timetable_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tt_imports_select" ON timetable_imports;
DROP POLICY IF EXISTS "tt_imports_insert" ON timetable_imports;
DROP POLICY IF EXISTS "tt_imports_update" ON timetable_imports;
DROP POLICY IF EXISTS "tt_imports_delete" ON timetable_imports;

CREATE POLICY "tt_imports_select" ON timetable_imports
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "tt_imports_insert" ON timetable_imports
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "tt_imports_update" ON timetable_imports
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "tt_imports_delete" ON timetable_imports
  FOR DELETE USING (public.is_admin());

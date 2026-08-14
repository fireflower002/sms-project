-- ============================================================
-- MIGRATION: 20260803_audit_fixes.sql
-- Fixes RLS Subquery Recursion, Adds Missing Indexes, and Normalizes Subject Casing
-- ============================================================

-- ------------------------------------------------------------
-- 1) RLS RECURSION FIX: SECURITY DEFINER helper function
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ------------------------------------------------------------
-- Rewrite RLS policies across target tables
-- ------------------------------------------------------------

-- PROFILES
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;

CREATE POLICY "profiles_select_admin" ON profiles FOR SELECT 
  USING (public.is_admin());

CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE 
  USING (public.is_admin());

-- CLASSES
DROP POLICY IF EXISTS "cls_insert" ON classes;
DROP POLICY IF EXISTS "cls_update" ON classes;
DROP POLICY IF EXISTS "cls_delete" ON classes;

CREATE POLICY "cls_insert" ON classes FOR INSERT 
  WITH CHECK (public.is_admin());

CREATE POLICY "cls_update" ON classes FOR UPDATE 
  USING (public.is_admin());

CREATE POLICY "cls_delete" ON classes FOR DELETE 
  USING (public.is_admin());

-- ABSENCES
DROP POLICY IF EXISTS "abs_select_admin" ON absences;
DROP POLICY IF EXISTS "abs_insert_admin" ON absences;
DROP POLICY IF EXISTS "abs_update_admin" ON absences;
DROP POLICY IF EXISTS "abs_delete_admin" ON absences;

CREATE POLICY "abs_select_admin" ON absences FOR SELECT 
  USING (public.is_admin());

CREATE POLICY "abs_insert_admin" ON absences FOR INSERT 
  WITH CHECK (public.is_admin());

CREATE POLICY "abs_update_admin" ON absences FOR UPDATE 
  USING (public.is_admin());

CREATE POLICY "abs_delete_admin" ON absences FOR DELETE 
  USING (public.is_admin());

-- SUBSTITUTIONS
DROP POLICY IF EXISTS "sub_insert" ON substitutions;
DROP POLICY IF EXISTS "sub_update" ON substitutions;
DROP POLICY IF EXISTS "sub_delete" ON substitutions;

CREATE POLICY "sub_insert" ON substitutions FOR INSERT 
  WITH CHECK (public.is_admin());

CREATE POLICY "sub_update" ON substitutions FOR UPDATE 
  USING (public.is_admin());

CREATE POLICY "sub_delete" ON substitutions FOR DELETE 
  USING (public.is_admin());

-- ANNOUNCEMENTS
DROP POLICY IF EXISTS "ann_insert" ON announcements;
DROP POLICY IF EXISTS "ann_update" ON announcements;

CREATE POLICY "ann_insert" ON announcements FOR INSERT 
  WITH CHECK (public.is_admin());

CREATE POLICY "ann_update" ON announcements FOR UPDATE 
  USING (public.is_admin());

-- INVENTORY
DROP POLICY IF EXISTS "inv_insert" ON inventory;
DROP POLICY IF EXISTS "inv_update" ON inventory;

CREATE POLICY "inv_insert" ON inventory FOR INSERT 
  WITH CHECK (public.is_admin());

CREATE POLICY "inv_update" ON inventory FOR UPDATE 
  USING (public.is_admin());

-- PROFILE CHANGE REQUESTS
DROP POLICY IF EXISTS "pcr_select_admin" ON profile_change_requests;
DROP POLICY IF EXISTS "pcr_update" ON profile_change_requests;

CREATE POLICY "pcr_select_admin" ON profile_change_requests FOR SELECT 
  USING (public.is_admin());

CREATE POLICY "pcr_update" ON profile_change_requests FOR UPDATE 
  USING (public.is_admin());


-- ------------------------------------------------------------
-- 2) MISSING INDEXES
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_teacher_day 
  ON schedule_assignments (teacher_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_absences_status_date 
  ON absences (status, absence_date DESC);

CREATE INDEX IF NOT EXISTS idx_substitutions_sub_teacher 
  ON substitutions (substitute_teacher_id);

CREATE INDEX IF NOT EXISTS idx_classes_class_teacher 
  ON classes (class_teacher_id);

CREATE INDEX IF NOT EXISTS idx_inventory_assignments_teacher 
  ON inventory_assignments (teacher_id);


-- ------------------------------------------------------------
-- 4) SUBJECT CASING NORMALIZATION DATA MIGRATION
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_subject(s text)
RETURNS text AS $$
DECLARE
  clean text := trim(s);
BEGIN
  IF lower(clean) IN ('english', 'english language') THEN
    RETURN 'English';
  ELSIF lower(clean) IN ('mathematics', 'maths') THEN
    RETURN 'Mathematics';
  ELSIF lower(clean) = 'science' THEN
    RETURN 'Science';
  ELSIF lower(clean) = 'music' THEN
    RETURN 'Music';
  ELSIF lower(clean) = 'robotics' THEN
    RETURN 'Robotics';
  ELSIF lower(clean) = 'sinhala' THEN
    RETURN 'Sinhala';
  ELSIF lower(clean) = 'english literature' THEN
    RETURN 'English Literature';
  ELSE
    RETURN initcap(clean);
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update profiles.subjects array entries
UPDATE profiles
SET subjects = (
  SELECT COALESCE(array_agg(DISTINCT public.normalize_subject(sub)), '{}'::text[])
  FROM unnest(subjects) AS sub
)
WHERE array_length(subjects, 1) > 0;

-- Update allowed_users.subjects array entries if any exist
UPDATE allowed_users
SET subjects = (
  SELECT COALESCE(array_agg(DISTINCT public.normalize_subject(sub)), '{}'::text[])
  FROM unnest(subjects) AS sub
)
WHERE array_length(subjects, 1) > 0;

-- ============================================================
-- CONSOLIDATED MIGRATION: 20260803_audit_fixes_consolidated.sql
-- Reflects the FINAL state of all database audit fixes applied on 2026-08-03
-- 
-- Summary of Changes:
-- 1. Helper Functions: Replaced recursive RLS subqueries with SECURITY DEFINER functions.
-- 2. Performance Indexes: Added composite and foreign key indexes.
-- 3. RLS Policies: Updated 30+ policies across 16 public tables for security & speed.
-- 4. Data Normalization: Standardized subject strings in profiles.subjects to Title Case.
-- ============================================================

-- ============================================================
-- SECTION 1: HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================

-- 1.1 Admin Role Check Helper
-- Replaces (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')) to prevent policy recursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1.2 Registered User Check Helper
-- Replaces (auth.uid() IN (SELECT id FROM profiles)) to verify active school profile membership without recursion.
CREATE OR REPLACE FUNCTION public.is_registered_user()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- SECTION 2: PERFORMANCE & FOREIGN KEY INDEXES
-- ============================================================

-- Timetable & Cover Lookup Composite Index
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_teacher_day 
  ON schedule_assignments (teacher_id, day_of_week);

-- Admin Disruption & Absence Status Index
CREATE INDEX IF NOT EXISTS idx_absences_status_date 
  ON absences (status, absence_date DESC);

-- Foreign Key Lookup Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_substitutions_sub_teacher 
  ON substitutions (substitute_teacher_id);

CREATE INDEX IF NOT EXISTS idx_classes_class_teacher 
  ON classes (class_teacher_id);

CREATE INDEX IF NOT EXISTS idx_inventory_assignments_teacher 
  ON inventory_assignments (teacher_id);


-- ============================================================
-- SECTION 3: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- --- 3.1 PROFILES ---
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;

CREATE POLICY "profiles_select_admin" ON profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE USING (public.is_admin());

-- --- 3.2 ALLOWED USERS ---
DROP POLICY IF EXISTS "allowed_select" ON allowed_users;
DROP POLICY IF EXISTS "allowed_insert" ON allowed_users;
DROP POLICY IF EXISTS "allowed_delete" ON allowed_users;

CREATE POLICY "allowed_select" ON allowed_users FOR SELECT USING (public.is_admin());
CREATE POLICY "allowed_insert" ON allowed_users FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "allowed_delete" ON allowed_users FOR DELETE USING (public.is_admin());

-- --- 3.3 CLASSES ---
DROP POLICY IF EXISTS "cls_select" ON classes;
DROP POLICY IF EXISTS "cls_insert" ON classes;
DROP POLICY IF EXISTS "cls_update" ON classes;
DROP POLICY IF EXISTS "cls_delete" ON classes;

CREATE POLICY "cls_select" ON classes FOR SELECT USING (public.is_registered_user());
CREATE POLICY "cls_insert" ON classes FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "cls_update" ON classes FOR UPDATE USING (public.is_admin());
CREATE POLICY "cls_delete" ON classes FOR DELETE USING (public.is_admin());

-- --- 3.4 TIMETABLE TEMPLATES ---
DROP POLICY IF EXISTS "tt_select" ON timetable_templates;
DROP POLICY IF EXISTS "tt_insert" ON timetable_templates;
DROP POLICY IF EXISTS "tt_update" ON timetable_templates;
DROP POLICY IF EXISTS "tt_delete" ON timetable_templates;

CREATE POLICY "tt_select" ON timetable_templates FOR SELECT USING (public.is_registered_user());
CREATE POLICY "tt_insert" ON timetable_templates FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "tt_update" ON timetable_templates FOR UPDATE USING (public.is_admin());
CREATE POLICY "tt_delete" ON timetable_templates FOR DELETE USING (public.is_admin());

-- --- 3.5 SCHEDULE ASSIGNMENTS ---
DROP POLICY IF EXISTS "sa_select" ON schedule_assignments;
DROP POLICY IF EXISTS "sa_insert" ON schedule_assignments;
DROP POLICY IF EXISTS "sa_update" ON schedule_assignments;
DROP POLICY IF EXISTS "sa_delete" ON schedule_assignments;

CREATE POLICY "sa_select" ON schedule_assignments FOR SELECT USING (public.is_registered_user());
CREATE POLICY "sa_insert" ON schedule_assignments FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "sa_update" ON schedule_assignments FOR UPDATE USING (public.is_admin());
CREATE POLICY "sa_delete" ON schedule_assignments FOR DELETE USING (public.is_admin());

-- --- 3.6 ABSENCES ---
DROP POLICY IF EXISTS "abs_select_admin" ON absences;
DROP POLICY IF EXISTS "abs_insert_admin" ON absences;
DROP POLICY IF EXISTS "abs_update_admin" ON absences;
DROP POLICY IF EXISTS "abs_delete_admin" ON absences;

CREATE POLICY "abs_select_admin" ON absences FOR SELECT USING (public.is_admin());
CREATE POLICY "abs_insert_admin" ON absences FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "abs_update_admin" ON absences FOR UPDATE USING (public.is_admin());
CREATE POLICY "abs_delete_admin" ON absences FOR DELETE USING (public.is_admin());

-- --- 3.7 SUBSTITUTIONS ---
DROP POLICY IF EXISTS "sub_select" ON substitutions;
DROP POLICY IF EXISTS "sub_insert" ON substitutions;
DROP POLICY IF EXISTS "sub_update" ON substitutions;
DROP POLICY IF EXISTS "sub_delete" ON substitutions;

CREATE POLICY "sub_select" ON substitutions FOR SELECT USING (public.is_registered_user());
CREATE POLICY "sub_insert" ON substitutions FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "sub_update" ON substitutions FOR UPDATE USING (public.is_admin());
CREATE POLICY "sub_delete" ON substitutions FOR DELETE USING (public.is_admin());

-- --- 3.8 SWAP REQUESTS ---
DROP POLICY IF EXISTS "swap_select" ON swap_requests;
DROP POLICY IF EXISTS "swap_update" ON swap_requests;

CREATE POLICY "swap_select" ON swap_requests FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = target_teacher_id OR public.is_admin()
);
CREATE POLICY "swap_update" ON swap_requests FOR UPDATE USING (
  auth.uid() = requester_id OR auth.uid() = target_teacher_id OR public.is_admin()
);

-- --- 3.9 ANNOUNCEMENTS & READS ---
DROP POLICY IF EXISTS "ann_select" ON announcements;
DROP POLICY IF EXISTS "ann_insert" ON announcements;
DROP POLICY IF EXISTS "ann_update" ON announcements;

CREATE POLICY "ann_select" ON announcements FOR SELECT USING (is_active = true AND public.is_registered_user());
CREATE POLICY "ann_insert" ON announcements FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "ann_update" ON announcements FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "reads_select" ON announcement_reads;
CREATE POLICY "reads_select" ON announcement_reads FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- --- 3.10 NOTIFICATIONS ---
-- Tightened insert check: Users can create notifications for themselves OR Admins can notify any user.
DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT 
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- --- 3.11 INVENTORY & ASSIGNMENTS ---
DROP POLICY IF EXISTS "inv_select" ON inventory;
DROP POLICY IF EXISTS "inv_insert" ON inventory;
DROP POLICY IF EXISTS "inv_update" ON inventory;

CREATE POLICY "inv_select" ON inventory FOR SELECT USING (public.is_registered_user());
CREATE POLICY "inv_insert" ON inventory FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "inv_update" ON inventory FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "inva_select" ON inventory_assignments;
DROP POLICY IF EXISTS "inva_insert" ON inventory_assignments;
DROP POLICY IF EXISTS "inva_update" ON inventory_assignments;

CREATE POLICY "inva_select" ON inventory_assignments FOR SELECT USING (public.is_registered_user());
CREATE POLICY "inva_insert" ON inventory_assignments FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "inva_update" ON inventory_assignments FOR UPDATE USING (public.is_admin());

-- --- 3.12 PROFILE CHANGE REQUESTS ---
DROP POLICY IF EXISTS "pcr_select_admin" ON profile_change_requests;
DROP POLICY IF EXISTS "pcr_update" ON profile_change_requests;

CREATE POLICY "pcr_select_admin" ON profile_change_requests FOR SELECT USING (public.is_admin());
CREATE POLICY "pcr_update" ON profile_change_requests FOR UPDATE USING (public.is_admin());

-- --- 3.13 AUDIT LOGS ---
DROP POLICY IF EXISTS "audit_select" ON audit_logs;
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;

CREATE POLICY "audit_select" ON audit_logs FOR SELECT USING (public.is_admin());
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT WITH CHECK (public.is_registered_user());

-- --- 3.14 HIVE MESSAGES ---
DROP POLICY IF EXISTS "hive_select" ON hive_messages;
DROP POLICY IF EXISTS "hive_insert" ON hive_messages;

CREATE POLICY "hive_select" ON hive_messages FOR SELECT USING (public.is_registered_user());
CREATE POLICY "hive_insert" ON hive_messages FOR INSERT WITH CHECK (auth.uid() = sender_id AND public.is_registered_user());


-- ============================================================
-- SECTION 4: DATA NORMALIZATION
-- ============================================================

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

UPDATE profiles
SET subjects = (
  SELECT COALESCE(array_agg(DISTINCT public.normalize_subject(sub)), '{}'::text[])
  FROM unnest(subjects) AS sub
)
WHERE array_length(subjects, 1) > 0;

UPDATE allowed_users
SET subjects = (
  SELECT COALESCE(array_agg(DISTINCT public.normalize_subject(sub)), '{}'::text[])
  FROM unnest(subjects) AS sub
)
WHERE array_length(subjects, 1) > 0;

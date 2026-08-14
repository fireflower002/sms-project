-- ============================================================
-- MIGRATION: 20260803_is_registered_user.sql
-- Creates public.is_registered_user() helper function and applies it to RLS select/insert policies
-- ============================================================

-- 1. Helper Function
CREATE OR REPLACE FUNCTION public.is_registered_user()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. TIMETABLE TEMPLATES
DROP POLICY IF EXISTS "tt_select" ON timetable_templates;
CREATE POLICY "tt_select" ON timetable_templates FOR SELECT 
  USING (public.is_registered_user());

-- 3. CLASSES
DROP POLICY IF EXISTS "cls_select" ON classes;
CREATE POLICY "cls_select" ON classes FOR SELECT 
  USING (public.is_registered_user());

-- 4. SCHEDULE ASSIGNMENTS
DROP POLICY IF EXISTS "sa_select" ON schedule_assignments;
CREATE POLICY "sa_select" ON schedule_assignments FOR SELECT 
  USING (public.is_registered_user());

-- 5. SUBSTITUTIONS
DROP POLICY IF EXISTS "sub_select" ON substitutions;
CREATE POLICY "sub_select" ON substitutions FOR SELECT 
  USING (public.is_registered_user());

-- 6. ANNOUNCEMENTS
DROP POLICY IF EXISTS "ann_select" ON announcements;
CREATE POLICY "ann_select" ON announcements FOR SELECT 
  USING (is_active = true AND public.is_registered_user());

-- 7. INVENTORY
DROP POLICY IF EXISTS "inv_select" ON inventory;
CREATE POLICY "inv_select" ON inventory FOR SELECT 
  USING (public.is_registered_user());

-- 8. INVENTORY ASSIGNMENTS
DROP POLICY IF EXISTS "inva_select" ON inventory_assignments;
CREATE POLICY "inva_select" ON inventory_assignments FOR SELECT 
  USING (public.is_registered_user());

-- 9. AUDIT LOGS
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT 
  WITH CHECK (public.is_registered_user());

-- 10. HIVE MESSAGES
DROP POLICY IF EXISTS "hive_select" ON hive_messages;
DROP POLICY IF EXISTS "hive_insert" ON hive_messages;

CREATE POLICY "hive_select" ON hive_messages FOR SELECT 
  USING (public.is_registered_user());

CREATE POLICY "hive_insert" ON hive_messages FOR INSERT 
  WITH CHECK (auth.uid() = sender_id AND public.is_registered_user());

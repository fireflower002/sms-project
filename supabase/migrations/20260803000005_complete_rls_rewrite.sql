-- ============================================================
-- MIGRATION: 20260803_complete_rls_rewrite.sql
-- Replaces all remaining subqueries on profiles with public.is_admin() or auth.role() = 'authenticated'
-- ============================================================

-- 1. NOTIFICATIONS
DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- 2. ALLOWED USERS
DROP POLICY IF EXISTS "allowed_select" ON allowed_users;
DROP POLICY IF EXISTS "allowed_insert" ON allowed_users;
DROP POLICY IF EXISTS "allowed_delete" ON allowed_users;

CREATE POLICY "allowed_select" ON allowed_users FOR SELECT USING (public.is_admin());
CREATE POLICY "allowed_insert" ON allowed_users FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "allowed_delete" ON allowed_users FOR DELETE USING (public.is_admin());

-- 3. TIMETABLE TEMPLATES
DROP POLICY IF EXISTS "tt_select" ON timetable_templates;
DROP POLICY IF EXISTS "tt_insert" ON timetable_templates;
DROP POLICY IF EXISTS "tt_update" ON timetable_templates;
DROP POLICY IF EXISTS "tt_delete" ON timetable_templates;

CREATE POLICY "tt_select" ON timetable_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tt_insert" ON timetable_templates FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "tt_update" ON timetable_templates FOR UPDATE USING (public.is_admin());
CREATE POLICY "tt_delete" ON timetable_templates FOR DELETE USING (public.is_admin());

-- 4. CLASSES (Select policy cleanup)
DROP POLICY IF EXISTS "cls_select" ON classes;
CREATE POLICY "cls_select" ON classes FOR SELECT USING (auth.role() = 'authenticated');

-- 5. SCHEDULE ASSIGNMENTS
DROP POLICY IF EXISTS "sa_select" ON schedule_assignments;
DROP POLICY IF EXISTS "sa_insert" ON schedule_assignments;
DROP POLICY IF EXISTS "sa_update" ON schedule_assignments;
DROP POLICY IF EXISTS "sa_delete" ON schedule_assignments;

CREATE POLICY "sa_select" ON schedule_assignments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sa_insert" ON schedule_assignments FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "sa_update" ON schedule_assignments FOR UPDATE USING (public.is_admin());
CREATE POLICY "sa_delete" ON schedule_assignments FOR DELETE USING (public.is_admin());

-- 6. SUBSTITUTIONS (Select policy cleanup)
DROP POLICY IF EXISTS "sub_select" ON substitutions;
CREATE POLICY "sub_select" ON substitutions FOR SELECT USING (auth.role() = 'authenticated');

-- 7. SWAP REQUESTS
DROP POLICY IF EXISTS "swap_select" ON swap_requests;
DROP POLICY IF EXISTS "swap_update" ON swap_requests;

CREATE POLICY "swap_select" ON swap_requests FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = target_teacher_id OR public.is_admin()
);
CREATE POLICY "swap_update" ON swap_requests FOR UPDATE USING (
  auth.uid() = requester_id OR auth.uid() = target_teacher_id OR public.is_admin()
);

-- 8. ANNOUNCEMENTS & READS
DROP POLICY IF EXISTS "ann_select" ON announcements;
CREATE POLICY "ann_select" ON announcements FOR SELECT USING (
  is_active = true AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "reads_select" ON announcement_reads;
CREATE POLICY "reads_select" ON announcement_reads FOR SELECT USING (
  auth.uid() = user_id OR public.is_admin()
);

-- 9. INVENTORY & ASSIGNMENTS
DROP POLICY IF EXISTS "inv_select" ON inventory;
CREATE POLICY "inv_select" ON inventory FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "inva_select" ON inventory_assignments;
DROP POLICY IF EXISTS "inva_insert" ON inventory_assignments;
DROP POLICY IF EXISTS "inva_update" ON inventory_assignments;

CREATE POLICY "inva_select" ON inventory_assignments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inva_insert" ON inventory_assignments FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "inva_update" ON inventory_assignments FOR UPDATE USING (public.is_admin());

-- 10. AUDIT LOGS
DROP POLICY IF EXISTS "audit_select" ON audit_logs;
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;

CREATE POLICY "audit_select" ON audit_logs FOR SELECT USING (public.is_admin());
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 11. HIVE MESSAGES
DROP POLICY IF EXISTS "hive_select" ON hive_messages;
DROP POLICY IF EXISTS "hive_insert" ON hive_messages;

CREATE POLICY "hive_select" ON hive_messages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "hive_insert" ON hive_messages FOR INSERT WITH CHECK (auth.uid() = sender_id AND auth.role() = 'authenticated');

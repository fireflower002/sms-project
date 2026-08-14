-- ============================================================
-- MIGRATION: 20260803_notif_insert_security.sql
-- Restricts notifications INSERT to self-notifications OR admin-created notifications
-- ============================================================

DROP POLICY IF EXISTS "notif_insert" ON notifications;

CREATE POLICY "notif_insert" ON notifications FOR INSERT 
  WITH CHECK (
    user_id = auth.uid() OR public.is_admin()
  );

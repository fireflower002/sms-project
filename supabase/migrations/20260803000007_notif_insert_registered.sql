-- ============================================================
-- MIGRATION: 20260803_notif_insert_registered.sql
-- Updates notifications.notif_insert policy to check public.is_registered_user()
-- ============================================================

DROP POLICY IF EXISTS "notif_insert" ON notifications;

CREATE POLICY "notif_insert" ON notifications FOR INSERT 
  WITH CHECK (public.is_registered_user());

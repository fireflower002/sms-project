-- MIGRATION: 20260819000002_restrict_announcement_classes_select.sql
-- Tighten RLS policy on announcement_classes table to restrict SELECT access to registered users only.

DROP POLICY IF EXISTS "ac_select" ON announcement_classes;

CREATE POLICY "ac_select" ON announcement_classes
  FOR SELECT USING (public.is_registered_user());

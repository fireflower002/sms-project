-- Migration: Notices Features (extending announcements)
-- Adds date/expiry support and class targeting to announcements

-- 1. Add start_date, end_date, and expiry_date columns
ALTER TABLE announcements
  ADD COLUMN start_date  timestamptz,
  ADD COLUMN end_date    timestamptz,
  ADD COLUMN expiry_date timestamptz;

-- 2. Create the join table for class targeting
CREATE TABLE IF NOT EXISTS announcement_classes (
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  class_id        uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  PRIMARY KEY (announcement_id, class_id)
);

-- 3. Enable RLS on the join table
ALTER TABLE announcement_classes ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for announcement_classes
DROP POLICY IF EXISTS "ac_select" ON announcement_classes;
CREATE POLICY "ac_select" ON announcement_classes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "ac_insert" ON announcement_classes;
CREATE POLICY "ac_insert" ON announcement_classes
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ac_delete" ON announcement_classes;
CREATE POLICY "ac_delete" ON announcement_classes
  FOR DELETE USING (public.is_admin());

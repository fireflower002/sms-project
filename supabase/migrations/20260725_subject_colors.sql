-- Create subjects table with persistent unique colors
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subjects_select" ON subjects;
DROP POLICY IF EXISTS "subjects_insert" ON subjects;
DROP POLICY IF EXISTS "subjects_update" ON subjects;
DROP POLICY IF EXISTS "subjects_delete" ON subjects;

CREATE POLICY "subjects_select" ON subjects FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "subjects_insert" ON subjects FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));
CREATE POLICY "subjects_update" ON subjects FOR UPDATE USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));
CREATE POLICY "subjects_delete" ON subjects FOR DELETE USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

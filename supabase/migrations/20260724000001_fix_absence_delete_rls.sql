-- Allow teachers to delete their own absence records
DROP POLICY IF EXISTS "abs_delete_own" ON absences;
CREATE POLICY "abs_delete_own" ON absences FOR DELETE USING (auth.uid() = teacher_id);

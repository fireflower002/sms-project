-- Migration: 20260810000001_substitute_absences_select_rls.sql
-- Description: Allow substitute teachers to SELECT the linked absence row for their assigned substitutions

DROP POLICY IF EXISTS "abs_select_substitute" ON absences;

CREATE POLICY "abs_select_substitute" ON absences FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM substitutions
    WHERE substitutions.absence_id = absences.id
      AND substitutions.substitute_teacher_id = auth.uid()
  )
);

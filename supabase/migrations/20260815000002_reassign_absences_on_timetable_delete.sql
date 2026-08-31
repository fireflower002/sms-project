-- Migration: 20260815000001_reassign_absences_on_timetable_delete.sql

-- 1. Create or replace trigger function to handle absence reassignment & active promotion before deletion
CREATE OR REPLACE FUNCTION reassign_absences_before_timetable_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_target_template_id uuid;
BEGIN
  -- Find the top remaining target template (prefer active if exists, otherwise newest remaining)
  SELECT id INTO v_target_template_id
  FROM timetable_templates
  WHERE id != OLD.id
  ORDER BY is_active DESC, created_at DESC
  LIMIT 1;

  -- Sole template safety exception: Block deletion if no other template exists
  IF v_target_template_id IS NULL THEN
    RAISE EXCEPTION 'Cannot delete the sole timetable template. At least one timetable template must exist to maintain school scheduling and absence history.';
  END IF;

  -- Reassign linked absences to the target template
  UPDATE absences
  SET template_id = v_target_template_id
  WHERE template_id = OLD.id;

  -- If deleting the active template, automatically promote the target template to active
  IF OLD.is_active = true THEN
    UPDATE timetable_templates
    SET is_active = true
    WHERE id = v_target_template_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach trigger to timetable_templates table
DROP TRIGGER IF EXISTS trigger_reassign_absences_before_timetable_delete ON timetable_templates;
CREATE TRIGGER trigger_reassign_absences_before_timetable_delete
BEFORE DELETE ON timetable_templates
FOR EACH ROW
EXECUTE FUNCTION reassign_absences_before_timetable_delete();

-- 3. Update Foreign Key constraint on absences.template_id to RESTRICT (failsafe)
ALTER TABLE absences
  DROP CONSTRAINT IF EXISTS absences_template_id_fkey;

ALTER TABLE absences
  ADD CONSTRAINT absences_template_id_fkey
  FOREIGN KEY (template_id)
  REFERENCES timetable_templates(id)
  ON DELETE RESTRICT;

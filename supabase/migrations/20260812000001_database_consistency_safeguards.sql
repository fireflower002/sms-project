-- 1. Alter absences template_id to be NOT NULL
-- First, backfill any remaining nulls (though the previous migration should have done it)
UPDATE absences a
SET template_id = COALESCE(
  (SELECT id FROM timetable_templates WHERE is_active = true LIMIT 1),
  (SELECT id FROM timetable_templates ORDER BY created_at DESC LIMIT 1)
)
WHERE template_id IS NULL;

-- Alter table constraint
ALTER TABLE absences ALTER COLUMN template_id SET NOT NULL;

-- 2. Trigger to auto-fill template_id on absences BEFORE INSERT
CREATE OR REPLACE FUNCTION auto_populate_absence_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.template_id IS NULL THEN
    SELECT id INTO NEW.template_id FROM timetable_templates WHERE is_active = true LIMIT 1;
    IF NEW.template_id IS NULL THEN
      SELECT id INTO NEW.template_id FROM timetable_templates ORDER BY created_at DESC LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_populate_absence_template ON absences;
CREATE TRIGGER trigger_auto_populate_absence_template
BEFORE INSERT ON absences
FOR EACH ROW
EXECUTE FUNCTION auto_populate_absence_template();

-- 3. Trigger to auto-fill schedule_assignment_id, class_id, subject on substitutions BEFORE INSERT OR UPDATE
CREATE OR REPLACE FUNCTION auto_populate_substitution_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_teacher_id uuid;
  v_absence_date date;
  v_day_of_week int;
  v_active_template_id uuid;
  v_sa_id uuid;
  v_class_id uuid;
  v_subject text;
BEGIN
  -- Get parent absence details
  SELECT teacher_id, absence_date, template_id INTO v_teacher_id, v_absence_date, v_active_template_id 
  FROM absences WHERE id = NEW.absence_id;
  
  -- If template_id is null on the absence, find the active template
  IF v_active_template_id IS NULL THEN
    SELECT id INTO v_active_template_id FROM timetable_templates WHERE is_active = true LIMIT 1;
    IF v_active_template_id IS NULL THEN
      SELECT id INTO v_active_template_id FROM timetable_templates ORDER BY created_at DESC LIMIT 1;
    END IF;
  END IF;

  -- Extract day of week (1 = Monday, 7 = Sunday) and fallback
  v_day_of_week := EXTRACT(ISODOW FROM v_absence_date)::int;
  IF v_day_of_week > 5 THEN
    v_day_of_week := 1; -- Saturday/Sunday fallback to Monday
  END IF;
  
  -- Find matching schedule assignment on the specified active template (prevents matching outdated/draft templates)
  SELECT id, class_id, subject INTO v_sa_id, v_class_id, v_subject
  FROM schedule_assignments
  WHERE teacher_id = v_teacher_id
    AND period_number = NEW.period_number
    AND day_of_week = v_day_of_week
    AND template_id = v_active_template_id
  LIMIT 1;
  
  -- Auto-populate fields if found
  IF v_sa_id IS NOT NULL THEN
    NEW.schedule_assignment_id := v_sa_id;
    IF NEW.class_id IS NULL THEN
      NEW.class_id := v_class_id;
    END IF;
    IF NEW.subject IS NULL THEN
      NEW.subject := v_subject;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_populate_substitution_assignment ON substitutions;
CREATE TRIGGER trigger_auto_populate_substitution_assignment
BEFORE INSERT OR UPDATE ON substitutions
FOR EACH ROW
EXECUTE FUNCTION auto_populate_substitution_assignment();

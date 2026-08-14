-- 1. Delete confirmed orphaned substitutions (where no matching schedule assignment exists)
DELETE FROM substitutions s
WHERE NOT EXISTS (
  SELECT 1
  FROM absences a
  JOIN schedule_assignments sa ON sa.teacher_id = a.teacher_id
  WHERE a.id = s.absence_id
    AND s.period_number = sa.period_number
    AND s.class_id = sa.class_id
    AND sa.day_of_week = (
      CASE EXTRACT(ISODOW FROM a.absence_date)
        WHEN 7 THEN 1 -- Sunday fallback to Monday
        WHEN 6 THEN 1 -- Saturday fallback to Monday
        ELSE EXTRACT(ISODOW FROM a.absence_date)
      END
    )
);

-- 2. Add columns to absences and substitutions
ALTER TABLE absences ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES timetable_templates(id) ON DELETE SET NULL;
ALTER TABLE substitutions ADD COLUMN IF NOT EXISTS schedule_assignment_id uuid REFERENCES schedule_assignments(id) ON DELETE CASCADE;

-- 3. Backfill template_id in absences table (using active template at the time of absence creation, or current active template as fallback)
UPDATE absences a
SET template_id = COALESCE(
  (SELECT id FROM timetable_templates WHERE is_active = true LIMIT 1),
  (SELECT id FROM timetable_templates ORDER BY created_at DESC LIMIT 1)
)
WHERE template_id IS NULL;

-- 4. Backfill schedule_assignment_id in substitutions table
-- We map by matching teacher_id (via absence), day_of_week, period_number, and class_id
UPDATE substitutions s
SET schedule_assignment_id = sa.id
FROM absences a
JOIN schedule_assignments sa ON sa.teacher_id = a.teacher_id
WHERE a.id = s.absence_id
  AND s.period_number = sa.period_number
  AND s.class_id = sa.class_id
  AND sa.day_of_week = (
    CASE EXTRACT(ISODOW FROM a.absence_date)
      WHEN 7 THEN 1
      WHEN 6 THEN 1
      ELSE EXTRACT(ISODOW FROM a.absence_date)
    END
  );

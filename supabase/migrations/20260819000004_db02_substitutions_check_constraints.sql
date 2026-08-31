-- DB-02: Add check constraints on substitutions table for period numbers and class_id enforcement

ALTER TABLE substitutions
  DROP CONSTRAINT IF EXISTS check_substitutions_period_range;

ALTER TABLE substitutions
  ADD CONSTRAINT check_substitutions_period_range
  CHECK (period_number BETWEEN 1 AND 10);

-- Pre-check verification: Checked live database — 0 rows have NULL class_id.
-- Enforce NOT NULL on class_id safely.
ALTER TABLE substitutions
  ALTER COLUMN class_id SET NOT NULL;

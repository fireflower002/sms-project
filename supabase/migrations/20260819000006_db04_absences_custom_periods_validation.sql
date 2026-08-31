-- DB-04: Add validation function and check constraint on absences.custom_periods array

CREATE OR REPLACE FUNCTION validate_custom_periods(periods int[])
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT COALESCE(
    (
      (SELECT bool_and(elem BETWEEN 1 AND 10) FROM unnest(periods) elem)
      AND
      (SELECT count(elem) FROM unnest(periods) elem) = (SELECT count(DISTINCT elem) FROM unnest(periods) elem)
    ),
    true
  );
$$;

ALTER TABLE absences
  DROP CONSTRAINT IF EXISTS check_custom_periods_valid;

ALTER TABLE absences
  ADD CONSTRAINT check_custom_periods_valid
  CHECK (validate_custom_periods(custom_periods));

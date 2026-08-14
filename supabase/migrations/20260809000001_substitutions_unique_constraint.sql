-- Migration to add unique constraint on (absence_id, period_number) in substitutions table
-- This enables Postgres ON CONFLICT (absence_id, period_number) DO UPDATE upsert handling

ALTER TABLE substitutions 
  ADD CONSTRAINT substitutions_absence_period_unique UNIQUE (absence_id, period_number);

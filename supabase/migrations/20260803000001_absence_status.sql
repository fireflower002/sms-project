-- Migration: Add status and rejection_reason columns to absences table

ALTER TABLE absences ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

ALTER TABLE absences ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Update existing absences to 'approved' for backwards compatibility
UPDATE absences SET status = 'approved' WHERE status IS NULL;

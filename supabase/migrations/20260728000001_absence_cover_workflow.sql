-- Migration for Redesigned Absence & Cover Workflow

-- 1. Add status and rejection_reason to absences table
ALTER TABLE absences ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

ALTER TABLE absences ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Update existing absences to 'approved' for backwards compatibility
UPDATE absences SET status = 'approved' WHERE status IS NULL;

-- 2. Add status and swap fields to substitutions table
ALTER TABLE substitutions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'assigned'
  CHECK (status IN ('assigned', 'swap_requested', 'reassigned', 'cancelled'));

ALTER TABLE substitutions ADD COLUMN IF NOT EXISTS swap_reason text;

ALTER TABLE substitutions ADD COLUMN IF NOT EXISTS swap_requested_at timestamptz;

-- Update RLS policies to ensure teachers can update their assigned substitutions when requesting a swap
DROP POLICY IF EXISTS "sub_update_teacher_swap" ON substitutions;
CREATE POLICY "sub_update_teacher_swap" ON substitutions FOR UPDATE
  USING (auth.uid() = substitute_teacher_id OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

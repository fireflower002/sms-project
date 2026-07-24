-- Migration: Add public_token and assignment columns to inventory table
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS public_token UUID UNIQUE DEFAULT gen_random_uuid();
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS condition_notes TEXT;

-- Backfill public_token for any existing rows that might be NULL
UPDATE inventory SET public_token = gen_random_uuid() WHERE public_token IS NULL;

-- Public RLS policy: allow anonymous users to SELECT non-deleted inventory rows looked up by public_token
DROP POLICY IF EXISTS "inv_public_select_by_token" ON inventory;
CREATE POLICY "inv_public_select_by_token" ON inventory
  FOR SELECT
  USING (
    is_active = true AND public_token IS NOT NULL
  );

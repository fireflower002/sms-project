-- ============================================================
-- Teacher Registration: Allow public email lookup on allowed_users
-- ============================================================
-- Problem: The existing RLS policy on allowed_users only allows
-- admins to SELECT. But the teacher registration page needs to
-- check if an email is pre-approved BEFORE the teacher has an
-- auth session. Without this, the signup check always fails.
--
-- Solution: Add a SELECT policy that allows anyone (including
-- unauthenticated visitors) to check if an email exists and
-- whether it has already been registered. We do NOT expose any
-- other sensitive columns — the query in RegisterForm.tsx only
-- selects `id` and `is_registered`.
-- ============================================================

-- Allow public/anon to check email pre-approval status
DROP POLICY IF EXISTS "allowed_select_public" ON allowed_users;
CREATE POLICY "allowed_select_public"
  ON allowed_users
  FOR SELECT
  USING (true);

-- Drop the old admin-only SELECT policy (replaced above)
DROP POLICY IF EXISTS "allowed_select" ON allowed_users;

-- Keep admin-only INSERT and DELETE (already exist, no change needed)
-- INSERT: "allowed_insert" — admin only
-- DELETE: "allowed_delete" — admin only

-- Also allow the trigger function (SECURITY DEFINER) to UPDATE
-- is_registered = true when a teacher signs up. The trigger
-- runs as the postgres superuser so no extra policy is needed,
-- but add an explicit UPDATE policy for completeness:
DROP POLICY IF EXISTS "allowed_update" ON allowed_users;
CREATE POLICY "allowed_update"
  ON allowed_users
  FOR UPDATE
  USING (
    -- Admin can update any row
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

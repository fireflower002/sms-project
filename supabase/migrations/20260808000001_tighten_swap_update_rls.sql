-- ============================================================
-- MIGRATION: 20260808_tighten_swap_update_rls.sql
-- PURPOSE:   Enforces Role-Based Status Transition WITH CHECK RLS Policy on swap_requests
-- DATE:      2026-08-04
-- ============================================================

-- ============================================================
-- SECTION 1: RLS POLICY UPDATE
-- ============================================================

-- Drop existing loose update policy
DROP POLICY IF EXISTS "swap_update" ON swap_requests;

-- CREATE POLICY: swap_update
-- USING: Restricts row updates to the requesting teacher, target teacher, or an admin
-- WITH CHECK: Enforces role-specific status control:
--   - Target teacher can only update status to 'peer_accepted' or 'peer_rejected'
--   - Requester teacher can only update status to 'cancelled'
--   - Admin can only update status to 'accepted' or 'rejected'
CREATE POLICY "swap_update" ON swap_requests FOR UPDATE
USING (
  auth.uid() = requester_id OR auth.uid() = target_teacher_id OR public.is_admin()
)
WITH CHECK (
  (auth.uid() = target_teacher_id AND status IN ('peer_accepted', 'peer_rejected'))
  OR (auth.uid() = requester_id AND status = 'cancelled')
  OR (public.is_admin() AND status IN ('accepted', 'rejected'))
);

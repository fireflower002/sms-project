-- ============================================================
-- Fix 1: Security Definer function to get user role (prevents RLS recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
  RETURN v_role;
END;
$$;

-- Drop old recursive profiles policies
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;

-- Re-create profiles policies using security definer helper
CREATE POLICY "profiles_select_admin" ON profiles FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- Fix 2: Close pre-registered teacher email leakage on allowed_users
-- ============================================================
DROP POLICY IF EXISTS "allowed_select_public" ON allowed_users;
DROP POLICY IF EXISTS "allowed_select" ON allowed_users;
DROP POLICY IF EXISTS "allowed_select_admin" ON allowed_users;

-- Restrict SELECT on allowed_users to admins only
CREATE POLICY "allowed_select_admin" ON allowed_users FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- Fix 3: Fix announcements RLS policies for delete and update
-- ============================================================
DROP POLICY IF EXISTS "ann_select" ON announcements;
DROP POLICY IF EXISTS "ann_insert" ON announcements;
DROP POLICY IF EXISTS "ann_update" ON announcements;
DROP POLICY IF EXISTS "ann_delete" ON announcements;
DROP POLICY IF EXISTS "announcements_delete" ON announcements;

-- Allow logged in users to view active announcements and admins to view all
CREATE POLICY "ann_select" ON announcements FOR SELECT USING (
  (is_active = true OR public.get_user_role(auth.uid()) = 'admin')
  AND auth.uid() IS NOT NULL
);

-- Allow admins to insert announcements
CREATE POLICY "ann_insert" ON announcements FOR INSERT WITH CHECK (
  public.get_user_role(auth.uid()) = 'admin'
);

-- Allow admins to update announcements
CREATE POLICY "ann_update" ON announcements FOR UPDATE
  USING (public.get_user_role(auth.uid()) = 'admin')
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- Allow admins to delete announcements
CREATE POLICY "ann_delete" ON announcements FOR DELETE
  USING (public.get_user_role(auth.uid()) = 'admin');

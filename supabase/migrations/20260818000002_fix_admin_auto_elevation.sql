-- Step 1: Add role column to allowed_users if not exists
ALTER TABLE allowed_users 
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'teacher' CHECK (role IN ('admin', 'teacher'));

-- Step 2: Ensure icecube3912@gmail.com and any profiles marked as admin are synced in allowed_users as admin
INSERT INTO allowed_users (email, full_name, role, is_registered, must_change_password)
VALUES ('icecube3912@gmail.com', 'Admin', 'admin', true, false)
ON CONFLICT (email) DO UPDATE SET role = 'admin';

UPDATE allowed_users 
SET role = 'admin' 
WHERE email IN (SELECT email FROM profiles WHERE role = 'admin');

-- Step 3: Update trigger function handle_new_user() to remove email pattern matching and empty profiles shortcut
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role        text := 'teacher';
  v_name        text;
  v_subjects    text[];
  v_must_change boolean := true;
  v_allowed_role text;
BEGIN
  -- 1. Check allowed_users for pre-approved role and details
  SELECT role, full_name, subjects, COALESCE(must_change_password, true)
  INTO v_allowed_role, v_name, v_subjects, v_must_change
  FROM allowed_users WHERE LOWER(email) = LOWER(NEW.email);

  -- 2. Strictly set role based on allowed_users (no email pattern matching or empty profile shortcuts)
  IF v_allowed_role IS NOT NULL AND v_allowed_role IN ('admin', 'teacher') THEN
    v_role := v_allowed_role;
  ELSE
    v_role := 'teacher';
  END IF;

  IF v_role = 'admin' THEN
    v_must_change := false;
  END IF;

  IF v_name IS NULL THEN
    v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  END IF;

  INSERT INTO profiles (id, email, full_name, role, subjects, must_change_password)
  VALUES (NEW.id, NEW.email, v_name, v_role, COALESCE(v_subjects, '{}'), v_must_change)
  ON CONFLICT (id) DO UPDATE SET 
    role = EXCLUDED.role,
    must_change_password = EXCLUDED.must_change_password;

  -- Mark as registered if in allowed_users
  UPDATE allowed_users SET is_registered = true WHERE LOWER(email) = LOWER(NEW.email);

  RETURN NEW;
END;
$$;

-- Step 4: Fix public.get_user_role helper to remove email pattern fallback
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
  RETURN COALESCE(v_role, 'teacher');
END;
$$;

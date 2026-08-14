-- Fix handle_new_user trigger to recognize admin role from metadata or email pattern
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role        text := 'teacher';
  v_name        text;
  v_subjects    text[];
  v_must_change boolean := true;
BEGIN
  -- 1. Determine Role
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL AND NEW.raw_user_meta_data->>'role' IN ('admin', 'teacher') THEN
    v_role := NEW.raw_user_meta_data->>'role';
  ELSIF LOWER(NEW.email) LIKE 'admin%' OR LOWER(NEW.email) LIKE '%admin@%' THEN
    v_role := 'admin';
  ELSIF NOT EXISTS (SELECT 1 FROM profiles) THEN
    v_role := 'admin';
  ELSE
    v_role := 'teacher';
  END IF;

  IF v_role = 'admin' THEN
    v_must_change := false;
  END IF;

  -- 2. Get name, subjects, and must_change_password from allowed_users if present
  SELECT full_name, subjects, COALESCE(must_change_password, v_must_change)
  INTO v_name, v_subjects, v_must_change
  FROM allowed_users WHERE email = NEW.email;

  IF v_name IS NULL THEN
    v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  END IF;

  INSERT INTO profiles (id, email, full_name, role, subjects, must_change_password)
  VALUES (NEW.id, NEW.email, v_name, v_role, COALESCE(v_subjects, '{}'), v_must_change)
  ON CONFLICT (id) DO UPDATE SET 
    role = EXCLUDED.role,
    must_change_password = EXCLUDED.must_change_password;

  -- Mark as registered if in allowed_users
  UPDATE allowed_users SET is_registered = true WHERE email = NEW.email;

  RETURN NEW;
END;
$$;

-- Fix public.get_user_role helper to fallback to email prefix if role is not set
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
  v_email text;
BEGIN
  SELECT role, email INTO v_role, v_email FROM profiles WHERE id = p_user_id;
  IF v_role IS NULL OR v_role = '' THEN
    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
    IF LOWER(v_email) LIKE 'admin%' THEN
      RETURN 'admin';
    END IF;
    RETURN 'teacher';
  END IF;
  RETURN v_role;
END;
$$;

-- Data Fix: Auto-correct profiles for admin emails
UPDATE profiles
SET role = 'admin', must_change_password = false
WHERE LOWER(email) LIKE 'admin%' 
   OR email IN (SELECT email FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin');

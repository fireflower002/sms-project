-- ============================================================
-- Add must_change_password to allowed_users and profiles
-- ============================================================

ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;

-- Update trigger function to propagate must_change_password to profiles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role      text := 'teacher';
  v_name      text;
  v_subjects  text[];
  v_must_change boolean := true;
BEGIN
  -- Check if admin (first user ever, or email matches admin list)
  IF NOT EXISTS (SELECT 1 FROM profiles) THEN
    v_role := 'admin';
    v_must_change := false;
  END IF;

  -- Get name, subjects, and must_change_password from allowed_users
  SELECT full_name, subjects, COALESCE(must_change_password, true)
  INTO v_name, v_subjects, v_must_change
  FROM allowed_users WHERE email = NEW.email;

  IF v_name IS NULL THEN
    v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  END IF;

  INSERT INTO profiles (id, email, full_name, role, subjects, must_change_password)
  VALUES (NEW.id, NEW.email, v_name, v_role, COALESCE(v_subjects, '{}'), v_must_change)
  ON CONFLICT (id) DO UPDATE SET must_change_password = EXCLUDED.must_change_password;

  -- Mark as registered
  UPDATE allowed_users SET is_registered = true WHERE email = NEW.email;

  RETURN NEW;
END;
$$;

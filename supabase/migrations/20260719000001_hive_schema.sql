-- ============================================================
-- STEP 1: Core Tables
-- ============================================================

-- Profiles (all users: admin + teacher)
CREATE TABLE IF NOT EXISTS profiles (
  id              uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text        NOT NULL UNIQUE,
  full_name       text        NOT NULL,
  role            text        NOT NULL CHECK (role IN ('admin','teacher')),
  is_active       boolean     NOT NULL DEFAULT true,
  subjects        text[]      DEFAULT '{}',
  subject_colors  jsonb       DEFAULT '{}',
  phone           text,
  avatar_url      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Pre-registered teacher emails (before they sign up)
CREATE TABLE IF NOT EXISTS allowed_users (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text        NOT NULL UNIQUE,
  full_name       text        NOT NULL,
  subjects        text[]      DEFAULT '{}',
  is_registered   boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "profiles_select_own"   ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_insert"       ON profiles;

CREATE POLICY "profiles_select_own"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_select_admin" ON profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "profiles_update_own"   ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE USING (public.is_admin());
CREATE POLICY "profiles_insert"       ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Allowed users policies
DROP POLICY IF EXISTS "allowed_select" ON allowed_users;
DROP POLICY IF EXISTS "allowed_insert" ON allowed_users;
DROP POLICY IF EXISTS "allowed_delete" ON allowed_users;

CREATE POLICY "allowed_select" ON allowed_users FOR SELECT USING (public.is_admin());
CREATE POLICY "allowed_insert" ON allowed_users FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "allowed_delete" ON allowed_users FOR DELETE USING (public.is_admin());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role      text := 'teacher';
  v_name      text;
  v_subjects  text[];
BEGIN
  -- Check if admin (first user ever, or email matches admin list)
  IF NOT EXISTS (SELECT 1 FROM profiles) THEN
    v_role := 'admin';
  END IF;

  -- Get name + subjects from allowed_users
  SELECT full_name, subjects INTO v_name, v_subjects
  FROM allowed_users WHERE email = NEW.email;

  IF v_name IS NULL THEN
    v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  END IF;

  INSERT INTO profiles (id, email, full_name, role, subjects)
  VALUES (NEW.id, NEW.email, v_name, v_role, COALESCE(v_subjects, '{}'))
  ON CONFLICT (id) DO NOTHING;

  -- Mark as registered
  UPDATE allowed_users SET is_registered = true WHERE email = NEW.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- STEP 2: Timetable Tables
-- ============================================================

-- Timetable templates
CREATE TABLE IF NOT EXISTS timetable_templates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  start_time       text        NOT NULL, -- HH:MM
  end_time         text        NOT NULL, -- HH:MM
  period_duration  int         NOT NULL DEFAULT 40, -- minutes
  breaks           jsonb       DEFAULT '[]', -- [{after_period, duration, label}]
  is_active        boolean     NOT NULL DEFAULT false,
  created_by       uuid        REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Classes (Grade 1-A, Grade 1-B etc.)
CREATE TABLE IF NOT EXISTS classes (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text    NOT NULL,
  grade_level  int     NOT NULL,
  slug         text    NOT NULL UNIQUE,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Schedule assignments (who teaches what, when, where)
CREATE TABLE IF NOT EXISTS schedule_assignments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id    uuid        NOT NULL REFERENCES timetable_templates(id) ON DELETE CASCADE,
  class_id       uuid        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week    int         NOT NULL CHECK (day_of_week BETWEEN 1 AND 5), -- 1=Mon
  period_number  int         NOT NULL,
  subject        text        NOT NULL,
  subject_color  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, class_id, day_of_week, period_number)
);

-- RLS
ALTER TABLE timetable_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_assignments  ENABLE ROW LEVEL SECURITY;

-- Templates
DROP POLICY IF EXISTS "tt_select" ON timetable_templates;
DROP POLICY IF EXISTS "tt_insert" ON timetable_templates;
DROP POLICY IF EXISTS "tt_update" ON timetable_templates;
DROP POLICY IF EXISTS "tt_delete" ON timetable_templates;

CREATE POLICY "tt_select" ON timetable_templates FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles));
CREATE POLICY "tt_insert" ON timetable_templates FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "tt_update" ON timetable_templates FOR UPDATE USING (public.is_admin());
CREATE POLICY "tt_delete" ON timetable_templates FOR DELETE USING (public.is_admin());

-- Classes
DROP POLICY IF EXISTS "cls_select" ON classes;
DROP POLICY IF EXISTS "cls_insert" ON classes;
DROP POLICY IF EXISTS "cls_update" ON classes;
DROP POLICY IF EXISTS "cls_delete" ON classes;

CREATE POLICY "cls_select" ON classes FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles));
CREATE POLICY "cls_insert" ON classes FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "cls_update" ON classes FOR UPDATE USING (public.is_admin());
CREATE POLICY "cls_delete" ON classes FOR DELETE USING (public.is_admin());

-- Assignments
DROP POLICY IF EXISTS "sa_select" ON schedule_assignments;
DROP POLICY IF EXISTS "sa_insert" ON schedule_assignments;
DROP POLICY IF EXISTS "sa_update" ON schedule_assignments;
DROP POLICY IF EXISTS "sa_delete" ON schedule_assignments;

CREATE POLICY "sa_select" ON schedule_assignments FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles));
CREATE POLICY "sa_insert" ON schedule_assignments FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "sa_update" ON schedule_assignments FOR UPDATE USING (public.is_admin());
CREATE POLICY "sa_delete" ON schedule_assignments FOR DELETE USING (public.is_admin());

-- RPC to execute a swap (swaps two schedule assignments atomically)
CREATE OR REPLACE FUNCTION execute_schedule_swap(
  p_requester_id  uuid,
  p_target_id     uuid,
  p_swap_date     date,
  p_req_period    int,
  p_tgt_period    int,
  p_req_class_id  uuid,
  p_tgt_class_id  uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_template_id uuid;
  v_day         int;
BEGIN
  SELECT id INTO v_template_id FROM timetable_templates WHERE is_active = true LIMIT 1;
  v_day := EXTRACT(ISODOW FROM p_swap_date)::int;

  -- Swap requester's period to target teacher
  UPDATE schedule_assignments
  SET teacher_id = p_target_id
  WHERE template_id = v_template_id
    AND class_id = p_req_class_id
    AND day_of_week = v_day
    AND period_number = p_req_period;

  -- Swap target's period to requester teacher
  UPDATE schedule_assignments
  SET teacher_id = p_requester_id
  WHERE template_id = v_template_id
    AND class_id = p_tgt_class_id
    AND day_of_week = v_day
    AND period_number = p_tgt_period;
END;
$$;

-- ============================================================
-- STEP 3: Absences & Substitutions
-- ============================================================

CREATE TABLE IF NOT EXISTS absences (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  absence_date    date        NOT NULL,
  absence_type    text        NOT NULL DEFAULT 'full_day'
                  CHECK (absence_type IN ('full_day','morning_block','afternoon_block','custom_periods')),
  custom_periods  int[]       DEFAULT '{}',
  reason          text,
  reported_by     uuid        REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS substitutions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  absence_id              uuid        NOT NULL REFERENCES absences(id) ON DELETE CASCADE,
  substitute_teacher_id   uuid        NOT NULL REFERENCES profiles(id),
  period_number           int         NOT NULL,
  class_id                uuid        REFERENCES classes(id),
  subject                 text,
  notified                boolean     NOT NULL DEFAULT false,
  notified_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE absences       ENABLE ROW LEVEL SECURITY;
ALTER TABLE substitutions  ENABLE ROW LEVEL SECURITY;

-- Absences
DROP POLICY IF EXISTS "abs_select_admin"   ON absences;
DROP POLICY IF EXISTS "abs_select_own"     ON absences;
DROP POLICY IF EXISTS "abs_insert_admin"   ON absences;
DROP POLICY IF EXISTS "abs_insert_teacher" ON absences;
DROP POLICY IF EXISTS "abs_update_admin"   ON absences;
DROP POLICY IF EXISTS "abs_delete_admin"   ON absences;

CREATE POLICY "abs_select_admin"   ON absences FOR SELECT USING (public.is_admin());
CREATE POLICY "abs_select_own"     ON absences FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "abs_insert_admin"   ON absences FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "abs_insert_teacher" ON absences FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "abs_update_admin"   ON absences FOR UPDATE USING (public.is_admin());
CREATE POLICY "abs_delete_admin"   ON absences FOR DELETE USING (public.is_admin());

-- Substitutions
DROP POLICY IF EXISTS "sub_select" ON substitutions;
DROP POLICY IF EXISTS "sub_insert" ON substitutions;
DROP POLICY IF EXISTS "sub_update" ON substitutions;
DROP POLICY IF EXISTS "sub_delete" ON substitutions;

CREATE POLICY "sub_select" ON substitutions FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles));
CREATE POLICY "sub_insert" ON substitutions FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "sub_update" ON substitutions FOR UPDATE USING (public.is_admin());
CREATE POLICY "sub_delete" ON substitutions FOR DELETE USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_absences_date      ON absences(absence_date);
CREATE INDEX IF NOT EXISTS idx_absences_teacher   ON absences(teacher_id);
CREATE INDEX IF NOT EXISTS idx_subs_absence       ON substitutions(absence_id);

-- ============================================================
-- STEP 4: Swaps, Announcements, Notifications
-- ============================================================

-- Swap requests
CREATE TABLE IF NOT EXISTS swap_requests (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id          uuid        NOT NULL REFERENCES profiles(id),
  target_teacher_id     uuid        NOT NULL REFERENCES profiles(id),
  requester_class_id    uuid        REFERENCES classes(id),
  target_class_id       uuid        REFERENCES classes(id),
  requester_period      int         NOT NULL,
  target_period         int         NOT NULL,
  swap_date             date        NOT NULL,
  status                text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','peer_accepted','peer_rejected','accepted','rejected','cancelled')),
  note                  text,
  admin_approved        boolean     DEFAULT false,
  admin_approved_at     timestamptz,
  peer_responded_at     timestamptz,
  responded_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text        NOT NULL,
  body              text        NOT NULL,
  category          text        NOT NULL DEFAULT 'General'
                  CHECK (category IN ('General','Urgent','Event','Holiday','Exam','Other')),
  priority          text        NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high')),
  is_pinned         boolean     NOT NULL DEFAULT false,
  is_active         boolean     NOT NULL DEFAULT true,
  is_published      boolean     NOT NULL DEFAULT true,
  target_audience   text        NOT NULL DEFAULT 'teachers'
                  CHECK (target_audience IN ('all','teachers')),
  created_by        uuid        REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Announcement read receipts
CREATE TABLE IF NOT EXISTS announcement_reads (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id  uuid        NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        text        NOT NULL,
  title       text        NOT NULL,
  body        text,
  link        text,
  is_read     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE swap_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;

-- Swaps
DROP POLICY IF EXISTS "swap_select" ON swap_requests;
DROP POLICY IF EXISTS "swap_insert" ON swap_requests;
DROP POLICY IF EXISTS "swap_update" ON swap_requests;

CREATE POLICY "swap_select" ON swap_requests FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = target_teacher_id OR public.is_admin()
);
CREATE POLICY "swap_insert" ON swap_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "swap_update" ON swap_requests FOR UPDATE USING (
  auth.uid() = requester_id OR auth.uid() = target_teacher_id OR public.is_admin()
);

-- Announcements
DROP POLICY IF EXISTS "ann_select" ON announcements;
DROP POLICY IF EXISTS "ann_insert" ON announcements;
DROP POLICY IF EXISTS "ann_update" ON announcements;

CREATE POLICY "ann_select" ON announcements FOR SELECT USING (
  is_active = true AND auth.uid() IN (SELECT id FROM profiles)
);
CREATE POLICY "ann_insert" ON announcements FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "ann_update" ON announcements FOR UPDATE USING (public.is_admin());

-- Reads
DROP POLICY IF EXISTS "reads_select" ON announcement_reads;
DROP POLICY IF EXISTS "reads_insert" ON announcement_reads;

CREATE POLICY "reads_select" ON announcement_reads FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "reads_insert" ON announcement_reads FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notifications
DROP POLICY IF EXISTS "notif_select" ON notifications;
DROP POLICY IF EXISTS "notif_insert" ON notifications;
DROP POLICY IF EXISTS "notif_update" ON notifications;

CREATE POLICY "notif_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_insert" ON notifications FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM profiles));
CREATE POLICY "notif_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notif_user   ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_swap_req     ON swap_requests(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_swap_tgt     ON swap_requests(target_teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_ann_active   ON announcements(is_active, created_at DESC);

-- ============================================================
-- STEP 5: Inventory, Profile Requests, Audit Logs
-- ============================================================

-- Inventory items
CREATE TABLE IF NOT EXISTS inventory (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text        NOT NULL,
  description           text,
  category              text        NOT NULL DEFAULT 'Other'
                        CHECK (category IN ('Electronics','Lab Equipment','Sports Equipment','Books & Stationery','Furniture','Musical Instruments','Chemicals','Safety Equipment','Other')),
  condition             text        NOT NULL DEFAULT 'good'
                        CHECK (condition IN ('new','good','fair','poor','damaged','retired')),
  quantity_total        int         NOT NULL DEFAULT 1,
  quantity_available    int         NOT NULL DEFAULT 1,
  low_stock_threshold   int         NOT NULL DEFAULT 1,
  location              text,
  serial_number         text,
  barcode               text        UNIQUE,
  purchase_date         date,
  purchase_price        numeric(10,2),
  notes                 text,
  is_active             boolean     NOT NULL DEFAULT true,
  created_by            uuid        REFERENCES profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Inventory assignments (items assigned to teachers)
CREATE TABLE IF NOT EXISTS inventory_assignments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid        NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  teacher_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quantity     int         NOT NULL DEFAULT 1,
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  returned_at  timestamptz,
  is_active    boolean     NOT NULL DEFAULT true,
  notes        text
);

-- Profile change requests (teacher submits → admin approves)
CREATE TABLE IF NOT EXISTS profile_change_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status          text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  new_full_name   text,
  new_phone       text,
  new_subjects    text[],
  admin_note      text,
  reviewed_by     uuid        REFERENCES profiles(id),
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  action        text        NOT NULL,
  target_table  text,
  target_id     uuid,
  old_value     jsonb,
  new_value     jsonb,
  performed_by  uuid        REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE inventory              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;

-- Inventory
DROP POLICY IF EXISTS "inv_select" ON inventory;
DROP POLICY IF EXISTS "inv_insert" ON inventory;
DROP POLICY IF EXISTS "inv_update" ON inventory;

CREATE POLICY "inv_select" ON inventory FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles));
CREATE POLICY "inv_insert" ON inventory FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "inv_update" ON inventory FOR UPDATE USING (public.is_admin());

-- Inventory assignments
DROP POLICY IF EXISTS "inva_select" ON inventory_assignments;
DROP POLICY IF EXISTS "inva_insert" ON inventory_assignments;
DROP POLICY IF EXISTS "inva_update" ON inventory_assignments;

CREATE POLICY "inva_select" ON inventory_assignments FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles));
CREATE POLICY "inva_insert" ON inventory_assignments FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "inva_update" ON inventory_assignments FOR UPDATE USING (public.is_admin());

-- Profile change requests
DROP POLICY IF EXISTS "pcr_select_own"   ON profile_change_requests;
DROP POLICY IF EXISTS "pcr_select_admin" ON profile_change_requests;
DROP POLICY IF EXISTS "pcr_insert"       ON profile_change_requests;
DROP POLICY IF EXISTS "pcr_update"       ON profile_change_requests;

CREATE POLICY "pcr_select_own"   ON profile_change_requests FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "pcr_select_admin" ON profile_change_requests FOR SELECT USING (public.is_admin());
CREATE POLICY "pcr_insert"       ON profile_change_requests FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "pcr_update"       ON profile_change_requests FOR UPDATE USING (public.is_admin());

-- Audit logs
DROP POLICY IF EXISTS "audit_select" ON audit_logs;
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;

CREATE POLICY "audit_select" ON audit_logs FOR SELECT USING (public.is_admin());
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM profiles));

-- Auto-generate barcode on inventory insert
CREATE OR REPLACE FUNCTION generate_inventory_barcode()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.barcode IS NULL THEN
    NEW.barcode := 'INV-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD((SELECT COUNT(*) + 1 FROM inventory)::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_inventory_barcode ON inventory;
CREATE TRIGGER set_inventory_barcode
  BEFORE INSERT ON inventory
  FOR EACH ROW EXECUTE FUNCTION generate_inventory_barcode();

-- ============================================================
-- STEP 6: Hive Chat + Realtime + Final Setup
-- ============================================================

-- Group chat (all admins + teachers)
CREATE TABLE IF NOT EXISTS hive_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        text        NOT NULL CHECK (char_length(body) > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hive_created ON hive_messages(created_at DESC);

ALTER TABLE hive_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hive_select" ON hive_messages;
DROP POLICY IF EXISTS "hive_insert" ON hive_messages;

CREATE POLICY "hive_select" ON hive_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','teacher'))
  );

CREATE POLICY "hive_insert" ON hive_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','teacher'))
  );

-- Enable realtime for live chat idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hive_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE hive_messages;
  END IF;
END;
$$;
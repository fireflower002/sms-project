-- ============================================================
-- MIGRATION: 20260815000001_buffer_based_absence_cutoff.sql
-- PURPOSE:   Transition absence cutoff to a single configurable buffer 
--            (absence_buffer_hours) relative to timetable start_time & end_time,
--            and update absences_status_check constraint to include 'late_submission'.
-- ============================================================

-- 1. Safely rename old static column if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'school_settings' AND column_name = 'absence_cutoff_hours_before'
  ) THEN
    ALTER TABLE public.school_settings 
    RENAME COLUMN absence_cutoff_hours_before TO absence_cutoff_hours_before_deprecated;
  END IF;
END $$;

-- 2. Add the new configurable buffer hours column (Default = 2 hours)
ALTER TABLE public.school_settings 
ADD COLUMN IF NOT EXISTS absence_buffer_hours integer NOT NULL DEFAULT 2;

-- Update default settings row to ensure it has a valid buffer number
UPDATE public.school_settings
SET absence_buffer_hours = COALESCE(absence_buffer_hours, 2)
WHERE id = 'default' OR school_id = 'default';

-- 3. Update absences_status_check constraint to permit 'late_submission'
ALTER TABLE public.absences DROP CONSTRAINT IF EXISTS absences_status_check;
ALTER TABLE public.absences ADD CONSTRAINT absences_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'late_submission'));

-- ============================================================
-- 4. REWRITE TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_effective_minimum_absence_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_buffer_hours     integer;
  v_working_days     text[];
  v_allow_emergency  boolean;

  v_active_start     text;
  v_active_end       text;
  v_start_time       time;
  v_end_time         time;
  
  v_now_slt          timestamp;
  v_today_date       date;

  v_pending_cutoff   timestamp;
  v_day_end_cutoff   timestamp;

  v_target_dow       integer;
  v_target_day_name  text;
BEGIN
  -- 1. Admin Exemption
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- 2. Read settings from school_settings
  SELECT
    absence_buffer_hours,
    working_days,
    allow_emergency_absence
  INTO
    v_buffer_hours,
    v_working_days,
    v_allow_emergency
  FROM public.school_settings
  WHERE school_id = 'default' OR id = 'default'
  LIMIT 1;

  -- Fallback defaults
  IF v_buffer_hours IS NULL THEN
    v_buffer_hours := 2;
  END IF;
  IF v_working_days IS NULL THEN
    v_working_days := ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday']::text[];
  END IF;
  IF v_allow_emergency IS NULL THEN
    v_allow_emergency := true;
  END IF;

  -- 3. Get active timetable start_time and end_time
  SELECT start_time, end_time INTO v_active_start, v_active_end 
  FROM public.timetable_templates 
  WHERE is_active = true 
  LIMIT 1;

  IF v_active_start IS NULL THEN
    v_active_start := '07:30';
  END IF;
  IF v_active_end IS NULL THEN
    v_active_end := '13:30';
  END IF;

  v_start_time := v_active_start::time;
  v_end_time   := v_active_end::time;

  -- 4. Compute current timestamp in Asia/Colombo timezone
  v_now_slt    := now() AT TIME ZONE 'Asia/Colombo';
  v_today_date := v_now_slt::date;

  -- 5. Calculate cutoff timestamps for NEW.absence_date
  -- Late window starts buffer_hours before start_time (e.g. 05:50 AM on absence_date)
  v_pending_cutoff := (NEW.absence_date + v_start_time) - (v_buffer_hours * INTERVAL '1 hour');
  -- Day end cutoff (e.g. 13:30 or 15:30 on absence_date)
  v_day_end_cutoff := (NEW.absence_date + v_end_time) + (v_buffer_hours * INTERVAL '1 hour');

  -- 6. Emergency Exemption / Late Submission Check
  -- If submission is within the late window (between pending_cutoff and day_end_cutoff):
  IF v_now_slt >= v_pending_cutoff AND v_now_slt <= v_day_end_cutoff THEN
    IF NEW.status = 'late_submission' AND v_allow_emergency AND NEW.absence_date >= v_today_date THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Absence date % is within % hours of school start. Submissions during this time must be reported as emergency/late submissions.',
        NEW.absence_date, 
        v_buffer_hours;
    END IF;
  END IF;

  -- 7. If submission is AFTER day_end_cutoff, the school day has ended / is past
  IF v_now_slt > v_day_end_cutoff THEN
    RAISE EXCEPTION 'Absence date % is in the past or after the school day ended.', NEW.absence_date;
  END IF;

  -- 8. Enforce that absence_date is not strictly before today
  IF NEW.absence_date < v_today_date THEN
    RAISE EXCEPTION 'Absence date % cannot be in the past.', NEW.absence_date;
  END IF;

  -- 9. Reject if NEW.absence_date falls on a non-working day
  v_target_dow := EXTRACT(ISODOW FROM NEW.absence_date)::integer;
  CASE v_target_dow
    WHEN 1 THEN v_target_day_name := 'Monday';
    WHEN 2 THEN v_target_day_name := 'Tuesday';
    WHEN 3 THEN v_target_day_name := 'Wednesday';
    WHEN 4 THEN v_target_day_name := 'Thursday';
    WHEN 5 THEN v_target_day_name := 'Friday';
    WHEN 6 THEN v_target_day_name := 'Saturday';
    WHEN 7 THEN v_target_day_name := 'Sunday';
  END CASE;

  IF NOT (v_target_day_name = ANY(v_working_days)) THEN
    RAISE EXCEPTION 'Absence date % falls on a non-working day (%).',
      NEW.absence_date, v_target_day_name;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_effective_minimum_absence_date ON absences;
CREATE TRIGGER trg_check_effective_minimum_absence_date
  BEFORE INSERT OR UPDATE ON absences
  FOR EACH ROW
  EXECUTE FUNCTION public.check_effective_minimum_absence_date();

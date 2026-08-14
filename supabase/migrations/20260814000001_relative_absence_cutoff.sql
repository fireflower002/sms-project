-- ============================================================
-- MIGRATION: 20260814000001_relative_absence_cutoff.sql
-- PURPOSE:   Transition absence cutoff time to relative hours before start
-- ============================================================

-- Rename the old column for safety instead of dropping it
ALTER TABLE public.school_settings 
RENAME COLUMN absence_cutoff_time TO absence_cutoff_time_deprecated;

-- Add the new hours-before column
ALTER TABLE public.school_settings 
ADD COLUMN IF NOT EXISTS absence_cutoff_hours_before integer NOT NULL DEFAULT 14;

-- Data Migration: Convert clock time to hours-before relative period
DO $$
DECLARE
  v_active_start text;
  v_cutoff_time text;
  v_start_interval interval;
  v_cutoff_interval interval;
  v_diff_hours integer;
BEGIN
  -- 1. Fetch active timetable start time (default to '07:30')
  SELECT start_time INTO v_active_start FROM public.timetable_templates WHERE is_active = true LIMIT 1;
  IF v_active_start IS NULL THEN
    v_active_start := '07:30';
  END IF;

  -- 2. Fetch existing cutoff clock time from renamed column (default to '17:00')
  SELECT absence_cutoff_time_deprecated INTO v_cutoff_time FROM public.school_settings WHERE school_id = 'default' LIMIT 1;
  IF v_cutoff_time IS NULL THEN
    v_cutoff_time := '17:00';
  END IF;

  -- 3. Calculate difference: (24 hours - cutoff_time) + start_time
  v_start_interval := v_active_start::interval;
  v_cutoff_interval := v_cutoff_time::interval;

  v_diff_hours := ROUND(EXTRACT(epoch FROM (INTERVAL '24:00' - v_cutoff_interval + v_start_interval)) / 3600);

  -- 4. Update the settings row
  UPDATE public.school_settings
  SET absence_cutoff_hours_before = COALESCE(v_diff_hours, 14)
  WHERE id = 'default' OR school_id = 'default';
END $$;


-- ============================================================
-- TRIGGER FUNCTION REWRITE
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_effective_minimum_absence_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff_hours     integer;
  v_working_days     text[];
  v_allow_emergency  boolean;

  v_active_start     text;
  v_start_time       time;
  v_cutoff_timestamp timestamp;
  
  v_now_slt          timestamp;
  v_today_date       date;

  v_target_dow       integer;
  v_target_day_name  text;
BEGIN
  -- 1. Admin Exemption
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- 2. Read settings from school_settings
  SELECT
    absence_cutoff_hours_before,
    working_days,
    allow_emergency_absence
  INTO
    v_cutoff_hours,
    v_working_days,
    v_allow_emergency
  FROM public.school_settings
  WHERE school_id = 'default' OR id = 'default'
  LIMIT 1;

  -- Fallback defaults
  IF v_cutoff_hours IS NULL THEN
    v_cutoff_hours := 14;
  END IF;
  IF v_working_days IS NULL THEN
    v_working_days := ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday']::text[];
  END IF;
  IF v_allow_emergency IS NULL THEN
    v_allow_emergency := true;
  END IF;

  -- Get active timetable start time
  SELECT start_time INTO v_active_start FROM public.timetable_templates WHERE is_active = true LIMIT 1;
  IF v_active_start IS NULL THEN
    v_active_start := '07:30';
  END IF;
  v_start_time := v_active_start::time;

  -- 3. Compute current timestamp in Asia/Colombo timezone
  v_now_slt      := now() AT TIME ZONE 'Asia/Colombo';
  v_today_date   := v_now_slt::date;

  -- 4. Emergency Exemption
  IF NEW.status = 'late_submission' AND v_allow_emergency AND NEW.absence_date >= v_today_date THEN
    RETURN NEW;
  END IF;

  -- 5. Calculate cutoff timestamp for the target school day
  v_cutoff_timestamp := (NEW.absence_date + v_start_time) - (v_cutoff_hours * INTERVAL '1 hour');

  -- If current time is past the cutoff timestamp for the proposed date, reject it
  IF v_now_slt >= v_cutoff_timestamp THEN
    RAISE EXCEPTION 'Absence date % is past the cutoff time (% SLT) for non-admin submissions. Submissions within % hours of the school day must be reported as emergency absences.',
      NEW.absence_date, 
      to_char(v_cutoff_timestamp, 'YYYY-MM-DD HH24:MI'),
      v_cutoff_hours;
  END IF;

  -- 6. Enforce that absence_date is not in the past
  IF NEW.absence_date < v_today_date THEN
    RAISE EXCEPTION 'Absence date % cannot be in the past.', NEW.absence_date;
  END IF;

  -- 7. Reject if NEW.absence_date itself falls on a non-working day
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
    RAISE EXCEPTION 'Absence date % falls on a non-working day (%). Absences can only be reported for school working days.',
      NEW.absence_date, v_target_day_name;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- MIGRATION: 20260813000001_harden_absence_cutoff_trigger.sql
-- PURPOSE:   Harden dynamic absence cutoff trigger to prevent past-date submissions
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_effective_minimum_absence_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff_str       text;
  v_cutoff_time      time;
  v_working_days     text[];
  v_allow_emergency  boolean;

  v_now_slt          timestamp;
  v_today_date       date;
  v_current_time     time;

  v_curr_date        date;
  v_min_date         date;
  v_dow              integer;
  v_day_name         text;
  v_safety           integer := 0;

  v_target_dow       integer;
  v_target_day_name  text;
BEGIN
  -- 1. Admin Exemption: Admins are permitted to record absences for any date
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- 2. Read dynamic settings from school_settings
  SELECT
    absence_cutoff_time,
    working_days,
    allow_emergency_absence
  INTO
    v_cutoff_str,
    v_working_days,
    v_allow_emergency
  FROM public.school_settings
  WHERE school_id = 'default' OR id = 'default'
  LIMIT 1;

  -- Fallback defaults if school_settings row is missing
  IF v_cutoff_str IS NULL THEN
    v_cutoff_str := '17:00';
  END IF;
  IF v_working_days IS NULL THEN
    v_working_days := ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday']::text[];
  END IF;
  IF v_allow_emergency IS NULL THEN
    v_allow_emergency := true;
  END IF;

  -- 3. Compute current timestamp & time in Asia/Colombo timezone
  v_cutoff_time  := v_cutoff_str::time;
  v_now_slt      := now() AT TIME ZONE 'Asia/Colombo';
  v_today_date   := v_now_slt::date;
  v_current_time := v_now_slt::time;

  -- 4. Emergency Late Submission Exemption
  -- Bypasses date cutoff check when status is 'late_submission', allow_emergency_absence is enabled,
  -- AND the absence date is today or in the future in Sri Lanka Time (SLT).
  IF NEW.status = 'late_submission' AND v_allow_emergency AND NEW.absence_date >= v_today_date THEN
    RETURN NEW;
  END IF;

  -- 5. Calculate candidate start date based on cutoff time
  IF v_current_time < v_cutoff_time THEN
    v_curr_date := v_today_date;
  ELSE
    v_curr_date := v_today_date + 1;
  END IF;

  -- 6. Advance candidate start date until it lands on a configured working day
  WHILE v_safety < 14 LOOP
    v_dow := EXTRACT(ISODOW FROM v_curr_date)::integer; -- 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
    CASE v_dow
      WHEN 1 THEN v_day_name := 'Monday';
      WHEN 2 THEN v_day_name := 'Tuesday';
      WHEN 3 THEN v_day_name := 'Wednesday';
      WHEN 4 THEN v_day_name := 'Thursday';
      WHEN 5 THEN v_day_name := 'Friday';
      WHEN 6 THEN v_day_name := 'Saturday';
      WHEN 7 THEN v_day_name := 'Sunday';
    END CASE;

    IF v_day_name = ANY(v_working_days) THEN
      EXIT;
    END IF;

    v_curr_date := v_curr_date + 1;
    v_safety := v_safety + 1;
  END LOOP;

  v_min_date := v_curr_date;

  -- 7. Reject if NEW.absence_date is earlier than minimum allowed date
  IF NEW.absence_date < v_min_date THEN
    RAISE EXCEPTION 'Absence date % is earlier than the minimum allowed date (%) for non-admin submissions. Submissions after % or on non-working days must target the next working day.',
      NEW.absence_date, v_min_date, v_cutoff_str;
  END IF;

  -- 8. Reject if NEW.absence_date itself falls on a non-working day according to school_settings.working_days
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

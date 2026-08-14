-- Migration: Add RPC function for atomic per-profile subject color JSONB merge with admin security & hex color validation

CREATE OR REPLACE FUNCTION public.sync_subject_color_globally(
  p_subject text,
  p_color text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Enforce Admin privilege check
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Forbidden: Admin access required to update global subject colors.';
  END IF;

  -- 2. Validate subject name
  IF p_subject IS NULL OR trim(p_subject) = '' THEN
    RAISE EXCEPTION 'Invalid subject name: Subject name cannot be empty.';
  END IF;

  -- 3. Validate hex color format (#RRGGBB)
  IF p_color IS NULL OR p_color !~* '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Invalid color format: % (must be a valid 6-character hex color code, e.g. #3B82F6).', p_color;
  END IF;

  -- 4. Atomic JSONB merge into profiles.subject_colors across all rows
  UPDATE public.profiles
  SET subject_colors = COALESCE(subject_colors, '{}'::jsonb) || jsonb_build_object(trim(p_subject), p_color),
      updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_subject_color_globally(text, text) TO authenticated;

-- Migration: Add Class Teacher (Teacher in Charge) and default period pre-assignment fields to classes table

ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_teacher_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_teacher_periods integer DEFAULT 1 CHECK (class_teacher_periods IN (1, 2));
ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_teacher_subject text;

COMMENT ON COLUMN classes.class_teacher_id IS 'Teacher in charge of this class who takes the first 1 or 2 periods of every day';
COMMENT ON COLUMN classes.class_teacher_periods IS 'Number of default first periods (1 or 2) assigned to the class teacher every day';
COMMENT ON COLUMN classes.class_teacher_subject IS 'Subject taught by the class teacher during the default first periods';

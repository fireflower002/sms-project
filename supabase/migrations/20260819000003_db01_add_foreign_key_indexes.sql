-- DB-01: Add idempotent indexes on foreign key columns across core tables

CREATE INDEX IF NOT EXISTS idx_substitutions_absence_id 
  ON substitutions(absence_id);

CREATE INDEX IF NOT EXISTS idx_substitutions_substitute_teacher_id 
  ON substitutions(substitute_teacher_id);

CREATE INDEX IF NOT EXISTS idx_schedule_assignments_teacher_id 
  ON schedule_assignments(teacher_id);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement_id 
  ON announcement_reads(announcement_id);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_id 
  ON announcement_reads(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
  ON notifications(user_id);

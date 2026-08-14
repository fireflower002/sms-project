-- Recommended database addition to guard against teacher double-booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_period_unique 
ON schedule_assignments (template_id, teacher_id, day_of_week, period_number);

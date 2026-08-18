-- Migration: Drop unused empty subjects table
-- Created: August 18, 2026
-- Reason: Subject data and UI colors are stored directly on profiles (subjects text array and subject_colors jsonb) and schedule_assignments.subject text column.

DROP TABLE IF EXISTS public.subjects CASCADE;

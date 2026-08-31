-- DB-03: Alter timetable_imports.imported_by foreign key to ON DELETE SET NULL

ALTER TABLE timetable_imports
  DROP CONSTRAINT IF EXISTS timetable_imports_imported_by_fkey;

ALTER TABLE timetable_imports
  ADD CONSTRAINT timetable_imports_imported_by_fkey
  FOREIGN KEY (imported_by)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

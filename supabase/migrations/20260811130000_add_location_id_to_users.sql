-- Migration: add location_id to users for area assignment

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS location_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.constraint_schema = kcu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'users'
      AND kcu.column_name = 'location_id'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id);
  END IF;
END$$;

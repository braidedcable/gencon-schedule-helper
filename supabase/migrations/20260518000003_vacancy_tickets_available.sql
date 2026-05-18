ALTER TABLE vacancy_watches ADD COLUMN IF NOT EXISTS tickets_available INTEGER;

GRANT SELECT, INSERT, UPDATE, DELETE ON vacancy_watches TO service_role, anon, authenticated;

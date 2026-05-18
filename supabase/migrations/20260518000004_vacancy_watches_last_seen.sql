ALTER TABLE vacancy_watches
  ADD COLUMN last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE vacancy_watches SET last_seen = NOW();

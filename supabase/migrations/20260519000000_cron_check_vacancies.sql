create extension if not exists pg_net with schema extensions;

-- Replace any existing job before (re)creating it
select cron.unschedule(jobid) from cron.job where jobname = 'check-vacancies';

select cron.schedule(
  'check-vacancies',
  '*/20 * * * *',
  $$
  select net.http_post(
    url                  := 'https://wzowdavksnwsvhsyjamx.supabase.co/functions/v1/check-vacancies',
    headers              := '{"Content-Type": "application/json"}'::jsonb,
    body                 := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  $$
);

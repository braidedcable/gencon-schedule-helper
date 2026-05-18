# GenCon 2026 Schedule Helper

A collaborative event scheduling tool for GenCon 2026. Browse 25,000+ events, build a personal schedule, coordinate with a group in real time, and watch sold-out events for vacancies.

## Features

- **Browse & filter** — search and filter all GenCon events by day, type, cost, venue, experience, and more
- **My Schedule** — pick events, detect conflicts, export to `.ics`, share a link
- **Registration Wishlist** — star events before registration opens; open all registration tabs at once
- **Vacancy Watcher** — automatically monitors wishlisted sold-out events and alerts you when a spot opens
- **Group coordination** — join a named group to share picks, see overlapping interests, and chat in real time
- **Custom events** — add non-GenCon events (meals, travel) to your schedule

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 (CDN), vanilla CSS — no build step |
| Database | Supabase (PostgreSQL + Realtime) |
| Event data | Static `events.json` generated from GenCon's official Excel download |
| Automation | GitHub Actions |

## Data pipeline

Event data is refreshed every 6 hours via GitHub Actions:
1. Downloads `events.zip` from GenCon
2. Converts the Excel file to `events.json` using `convert.py`
3. Commits the updated file if anything changed

## Vacancy Watcher

Wishlist items are watched for registration openings without any extra setup:

1. Star events you want → they're automatically registered for vacancy checking
2. GitHub Actions runs `check_vacancies.py` every 20 minutes, fetching each event's page on GenCon.com
3. When "This event is SOLD OUT" disappears, Supabase Realtime delivers an alert to any open browser tabs
4. Desktop/Android users can enable browser push notifications to be alerted even when the tab isn't active
5. iOS users need to install the app via **Share → Add to Home Screen** for push notifications to work

Vacancy watches are personal (per device) and stored anonymously — no account needed.

## Supabase setup

Apply migrations in order from `supabase/migrations/`. Each migration file is idempotent.

Required GitHub Actions secrets:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role secret key (from Project Settings → API) |

## Local development

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. No install or build required.

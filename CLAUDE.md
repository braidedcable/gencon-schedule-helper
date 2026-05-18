# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

No build step. The app is three static files (`index.html`, `app.js`, `style.css`) served directly. To develop locally, any static file server works:

```bash
python3 -m http.server 8080
# or
npx serve .
```

The app loads `events.json` (15 MB, ~25k events) at startup. Serving via HTTP is required — `file://` won't work due to fetch restrictions.

To test the Python scripts locally:
```bash
pip install openpyxl requests supabase
python convert.py          # requires events.xlsx to exist
python check_vacancies.py  # requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars
```

To apply a migration:
```bash
PGPASSWORD='...' psql "postgresql://postgres.wzowdavksnwsvhsyjamx@aws-1-us-west-2.pooler.supabase.com:6543/postgres" -f supabase/migrations/<file>.sql
```

## Architecture

### Frontend
Vue 3 loaded from CDN (no npm, no bundler). All app logic lives in `app.js` as a single `createApp({ setup() { ... } })`. `index.html` contains all templates using Vue directives inline. There is no component split — everything is one SPA with tab-based navigation (Browse / My Schedule / Group).

State is split between **localStorage** (personal: picks, wishlist, custom events, session ID) and **Supabase** (shared: group picks, custom events, messages, vacancy watches). On mount, local state is synced to Supabase if the user is in a group.

The Supabase JS client (`sb`) is initialised at module scope with the publishable anon key. Anonymous auth (`sb.auth.signInAnonymously()`) is attempted on mount but is non-fatal if disabled.

### Event data pipeline
```
GenCon.com/downloads/events.zip
  → GitHub Actions (update-events.yml, every 6h)
  → convert.py (Excel → JSON)
  → events.json + meta.json committed to repo
  → served as static files, loaded into memory on app start
```

All filtering and search is done client-side in memory. `meta.json` holds the last-updated timestamp and is fetched with cache-busting on every load.

### Vacancy watcher
```
Browser (wishlist items)
  → vacancy_watches table (Supabase) via JS SDK
  → GitHub Actions (check-vacancies.yml, every 20min)
  → check_vacancies.py fetches each gencon.com/events/{numId}
  → checks for "This event is SOLD OUT" text
  → upserts sold_out + last_checked back to Supabase
  → Supabase Realtime fires to open browser tabs
  → in-app alert banner + browser push notification
```

Each device gets a stable anonymous `sessionId` (UUID in localStorage). Wishlist changes sync to `vacancy_watches` keyed by `(event_id, session_id)`. On every page load `syncVacancyWatches()` reconciles additions and removals.

### Supabase schema

| Table | Key columns | Notes |
|---|---|---|
| `groups` | `id`, `name` | One row per named group |
| `picks` | `group_id`, `user_name`, `event_id` | Unique on all three |
| `custom_events` | `id`, `group_id`, `user_name`, `title`, `start_time`, `end_time` | `id` is `custom-{timestamp}` |
| `messages` | `group_id`, `user_name`, `body` | Realtime-enabled, 500 char limit |
| `vacancy_watches` | `event_id`, `session_id`, `sold_out`, `last_checked` | Personal (no group), Realtime-enabled |

All tables use permissive RLS (public read/write). Every migration must include explicit `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO service_role, anon, authenticated` — RLS policies alone are not sufficient.

### GitHub Actions

- **`update-events.yml`** — runs every 6 hours, downloads GenCon's events.zip, runs `convert.py`, commits `events.json` + `meta.json` if changed. No Supabase interaction.
- **`check-vacancies.yml`** — runs every 20 minutes, runs `check_vacancies.py` using `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` secrets. Uses `supabase-py` SDK (same API as the JS frontend).

### Key patterns

**Event IDs** are strings like `26RPG12345`. The trailing digits are used for GenCon URLs: `id.match(/\d+$/)[0]` → `https://www.gencon.com/events/12345`.

**Custom events** use `id: custom-${Date.now()}` and a synthetic event shape with `type: 'ZED'`, `cost: 0`, `tix: 1`, `custom: true` to fit into the same display components as real events.

**Realtime subscriptions** use `postgres_changes` with `REPLICA IDENTITY FULL` on all subscribed tables. Vacancy watches filter by `session_id=eq.{sessionId}`; group subscriptions filter by `group_id`.

**iOS notifications** require the app to be installed as a PWA (Add to Home Screen). Detection uses `navigator.standalone === true`. The Notification API exists in mobile Safari but `requestPermission()` silently fails outside PWA mode.

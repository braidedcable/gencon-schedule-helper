"""
Reads all event IDs currently in vacancy_watches, fetches each GenCon event
page, checks for the "SOLD OUT" header, and writes the result back.
Run by the check-vacancies GitHub Actions workflow every 20 minutes.
"""
import os
import re
import time
import requests
from datetime import datetime, timezone
from supabase import create_client

sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])

GENCON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; GenConVacancyChecker/1.0)',
}


def check_event(event_id):
    m = re.search(r'\d+$', event_id)
    if not m:
        return None
    try:
        r = requests.get(
            f'https://www.gencon.com/events/{m.group()}',
            headers=GENCON_HEADERS,
            timeout=15,
        )
        r.raise_for_status()
        return bool(re.search(r'this event is sold out', r.text, re.IGNORECASE))
    except Exception as e:
        print(f'  {event_id}: fetch error — {e}')
        return None


def main():
    rows = sb.table('vacancy_watches').select('event_id').execute().data
    event_ids = list({r['event_id'] for r in rows})

    if not event_ids:
        print('No events being watched.')
        return

    print(f'Checking {len(event_ids)} event(s)...')
    now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    updated = 0
    for event_id in event_ids:
        sold_out = check_event(event_id)
        if sold_out is None:
            continue
        sb.table('vacancy_watches').update({'sold_out': sold_out, 'last_checked': now_iso}).eq('event_id', event_id).execute()
        label = 'SOLD OUT' if sold_out else 'AVAILABLE'
        print(f'  {event_id}: {label}')
        updated += 1
        time.sleep(0.5)

    print(f'Wrote {updated} update(s).')

    print('Done.')


if __name__ == '__main__':
    main()

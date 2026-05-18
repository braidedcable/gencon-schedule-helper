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

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_KEY']

BASE_HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
}

GENCON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; GenConVacancyChecker/1.0)',
}


def sb_get(path, params=''):
    resp = requests.get(f'{SUPABASE_URL}/rest/v1/{path}{params}', headers=BASE_HEADERS, timeout=15)
    resp.raise_for_status()
    return resp.json()


def sb_patch(path, payload):
    resp = requests.patch(
        f'{SUPABASE_URL}/rest/v1/{path}',
        headers={**BASE_HEADERS, 'Prefer': 'return=minimal'},
        json=payload,
        timeout=15,
    )
    return resp.status_code


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
    rows = sb_get('vacancy_watches', '?select=event_id')
    event_ids = list({r['event_id'] for r in rows})

    if not event_ids:
        print('No events being watched.')
        return

    print(f'Checking {len(event_ids)} event(s)...')
    now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    for event_id in event_ids:
        sold_out = check_event(event_id)
        if sold_out is None:
            continue
        status_code = sb_patch(
            f'vacancy_watches?event_id=eq.{event_id}',
            {'sold_out': sold_out, 'last_checked': now_iso},
        )
        label = 'SOLD OUT' if sold_out else 'AVAILABLE'
        print(f'  {event_id}: {label} (HTTP {status_code})')
        time.sleep(0.5)

    print('Done.')


if __name__ == '__main__':
    main()

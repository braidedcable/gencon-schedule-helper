"""
Reads all event IDs currently in vacancy_watches, fetches each GenCon event
page, checks for the "SOLD OUT" header, and writes the result back.
Run by the check-vacancies GitHub Actions workflow every 20 minutes.
"""
import os
import re
import time
import requests
import psycopg2
import psycopg2.extras
from datetime import datetime, timezone

DB_PASSWORD = os.environ['DB_PASSWORD']

GENCON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; GenConVacancyChecker/1.0)',
}


def get_conn():
    return psycopg2.connect(
        host='aws-1-us-west-2.pooler.supabase.com',
        port=6543,
        dbname='postgres',
        user='postgres.wzowdavksnwsvhsyjamx',
        password=DB_PASSWORD,
        sslmode='require',
    )


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
    conn = get_conn()
    cur = conn.cursor()

    cur.execute('SELECT DISTINCT event_id FROM vacancy_watches')
    event_ids = [row[0] for row in cur.fetchall()]

    if not event_ids:
        print('No events being watched.')
        conn.close()
        return

    print(f'Checking {len(event_ids)} event(s)...')
    now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    for event_id in event_ids:
        sold_out = check_event(event_id)
        if sold_out is None:
            continue
        cur.execute(
            'UPDATE vacancy_watches SET sold_out = %s, last_checked = %s WHERE event_id = %s',
            (sold_out, now_iso, event_id),
        )
        label = 'SOLD OUT' if sold_out else 'AVAILABLE'
        print(f'  {event_id}: {label}')
        time.sleep(0.5)

    conn.commit()
    conn.close()
    print('Done.')


if __name__ == '__main__':
    main()

import openpyxl, json, os
from datetime import datetime

def parse_dt(val):
    if not val:
        return ''
    if isinstance(val, datetime):
        return val.strftime('%Y-%m-%dT%H:%M')
    s = str(val).strip()
    for fmt in ('%m/%d/%Y %I:%M %p', '%m/%d/%Y %H:%M'):
        try:
            return datetime.strptime(s, fmt).strftime('%Y-%m-%dT%H:%M')
        except ValueError:
            continue
    return s

wb = openpyxl.load_workbook('events.xlsx', read_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
headers = rows[0]

events = []
for row in rows[1:]:
    r = dict(zip(headers, row))
    events.append({
        'id':    r.get('Game ID') or '',
        'grp':   r.get('Group') or '',
        'title': r.get('Title') or '',
        'desc':  r.get('Short Description') or '',
        'type':  r.get('Event Type') or '',
        'sys':   r.get('Game System') or '',
        'minP':  int(r.get('Minimum Players') or 0),
        'maxP':  int(r.get('Maximum Players') or 0),
        'age':   r.get('Age Required') or '',
        'exp':   r.get('Experience Required') or '',
        'mat':   str(r.get('Materials Required') or '') == 'Yes',
        'start': parse_dt(r.get('Start Date & Time')),
        'dur':   float(r.get('Duration') or 0),
        'end':   parse_dt(r.get('End Date & Time')),
        'gm':    r.get('GM Names') or '',
        'tour':  str(r.get('Tournament?') or '') == 'Yes',
        'cost':  float(r.get('Cost $') or 0),
        'loc':   r.get('Location') or '',
        'room':  r.get('Room Name') or '',
        'tbl':   str(r.get('Table Number') or ''),
        'tix':   int(r.get('Tickets Available') or 0),
        'cat':   r.get('Special Category') or '',
    })

print(f'Converted {len(events)} events')
with open('events.json', 'w') as f:
    json.dump(events, f, separators=(',', ':'))
print(f'events.json: {os.path.getsize("events.json") / 1024 / 1024:.1f} MB')

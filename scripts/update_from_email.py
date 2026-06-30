import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from dateutil import parser as dateparser

ROOT = Path(__file__).resolve().parents[1]
DATA_JS = ROOT / 'assets' / 'js' / 'data.js'
XLSX = ROOT / 'inbox' / 'latest.xlsx'
EMAIL_JSON = ROOT / 'inbox' / 'email.json'
PROCESSED = ROOT / 'inbox' / 'processed_message_ids.txt'


def load_current() -> Dict[str, Any]:
    txt = DATA_JS.read_text(encoding='utf-8')
    m = re.match(r'\s*window\.POLLA_DATA\s*=\s*(.*);\s*$', txt, re.S)
    if not m:
        raise ValueError('assets/js/data.js does not match expected window.POLLA_DATA format')
    return json.loads(m.group(1))


def save_data(data: Dict[str, Any]) -> None:
    DATA_JS.write_text('window.POLLA_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')


def normalize_name(x: Any) -> str:
    s = str(x or '').strip()
    s = re.sub(r'\s+', ' ', s)
    return s.upper()


def to_number(x: Any) -> Optional[float]:
    if pd.isna(x):
        return None
    if isinstance(x, (int, float)):
        return float(x)
    s = str(x).strip().replace(',', '.')
    m = re.search(r'-?\d+(?:\.\d+)?', s)
    return float(m.group()) if m else None


def infer_date(email: Dict[str, Any]) -> str:
    subject = email.get('subject', '')
    sent = email.get('sent', '')
    # Prefer date mentioned in subject/body if present: 29 JUNIO 2026, 29/06/2026, etc.
    month_map = {
        'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
        'julio': 7, 'agosto': 8, 'setiembre': 9, 'septiembre': 9, 'octubre': 10,
        'noviembre': 11, 'diciembre': 12,
        'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6, 'jul': 7,
        'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12,
    }
    text = (subject + '\n' + email.get('bodyText', ''))[:5000].lower()
    m = re.search(r'\b(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s+(20\d{2})\b', text)
    if m:
        return f"{int(m.group(3)):04d}-{month_map[m.group(2)]:02d}-{int(m.group(1)):02d}"
    m = re.search(r'\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b', text)
    if m:
        return f"{int(m.group(3)):04d}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    if sent:
        try:
            d = dateparser.parse(sent, dayfirst=True, fuzzy=True)
            # Beto often sends next morning; subject date is better, but if not found use send date.
            return d.date().isoformat()
        except Exception:
            pass
    return datetime.utcnow().date().isoformat()


def find_ranking_table(xlsx_path: Path) -> List[Dict[str, Any]]:
    """Best-effort extraction of the current ranking from Beto's Excel.

    Handles typical sheets where rows contain: position, participant/name, total points.
    If the workbook layout changes, this function is the only likely place to adjust.
    """
    xls = pd.ExcelFile(xlsx_path)
    best = []
    best_score = -1

    for sheet in xls.sheet_names:
        raw = pd.read_excel(xlsx_path, sheet_name=sheet, header=None, dtype=object)
        raw = raw.dropna(how='all').dropna(axis=1, how='all')
        if raw.empty:
            continue

        # Try header-based detection first.
        for header_i in range(min(25, len(raw))):
            headers = [normalize_name(v) for v in raw.iloc[header_i].tolist()]
            name_cols = [i for i,h in enumerate(headers) if any(k in h for k in ['PARTICIPANTE','NOMBRE','JUGADOR'])]
            point_cols = [i for i,h in enumerate(headers) if any(k in h for k in ['PUNTOS','PUNTAJE','TOTAL'])]
            pos_cols = [i for i,h in enumerate(headers) if any(k in h for k in ['POS','PUESTO','RANK'])]
            if name_cols and point_cols:
                name_col = name_cols[0]
                point_col = point_cols[-1]
                pos_col = pos_cols[0] if pos_cols else None
                rows = []
                for _, r in raw.iloc[header_i+1:].iterrows():
                    name = normalize_name(r.iloc[name_col] if name_col < len(r) else '')
                    pts = to_number(r.iloc[point_col] if point_col < len(r) else None)
                    if not name or len(name) < 3 or pts is None:
                        continue
                    if any(bad in name for bad in ['TOTAL', 'PARTICIPANTE', 'PUNTAJE']):
                        continue
                    pos = to_number(r.iloc[pos_col]) if pos_col is not None and pos_col < len(r) else None
                    rows.append({'Participante': name, 'Puntos': int(pts), 'Posicion': int(pos) if pos else None})
                if len(rows) > best_score:
                    best, best_score = rows, len(rows)

        # Fallback: detect rows with a numeric position, a name-like text cell, and numeric totals.
        rows = []
        for _, r in raw.iterrows():
            vals = r.tolist()
            texts = [(i, normalize_name(v)) for i,v in enumerate(vals) if isinstance(v, str) and len(normalize_name(v)) >= 3]
            nums = [(i, to_number(v)) for i,v in enumerate(vals) if to_number(v) is not None]
            if not texts or not nums:
                continue
            # Candidate name: longest text not a label.
            candidates = [(i,t) for i,t in texts if not any(b in t for b in ['TOTAL','PUNTAJE','PARTICIPANTE','POSICION','FECHA'])]
            if not candidates:
                continue
            name_i, name = max(candidates, key=lambda it: len(it[1]))
            # Total points usually highest/rightmost numeric after name; position usually first small number before name.
            after_nums = [(i,n) for i,n in nums if i > name_i]
            if not after_nums:
                continue
            pts = after_nums[-1][1]
            before_nums = [(i,n) for i,n in nums if i < name_i and 0 < n < 500]
            pos = before_nums[0][1] if before_nums else None
            if pts is not None and 0 <= pts < 10000:
                rows.append({'Participante': name, 'Puntos': int(pts), 'Posicion': int(pos) if pos else None})
        if len(rows) > best_score:
            best, best_score = rows, len(rows)

    # De-duplicate by participant, keeping max points.
    dedup: Dict[str, Dict[str, Any]] = {}
    for row in best:
        name = row['Participante']
        if name not in dedup or row['Puntos'] > dedup[name]['Puntos']:
            dedup[name] = row
    rows = list(dedup.values())
    if len(rows) < 20:
        raise ValueError(f'Could not confidently extract ranking table from Excel. Only found {len(rows)} rows.')

    rows.sort(key=lambda r: (-r['Puntos'], r.get('Posicion') or 9999, r['Participante']))
    # Normalize positions based on sorted points. Dense ties are intentionally not used because current site uses sequential positions.
    for i, row in enumerate(rows, 1):
        row['Posicion'] = i
    return rows


def compute_new_snapshot(current: Dict[str, Any], latest_rows: List[Dict[str, Any]], date_str: str) -> None:
    base = current.get('base', [])
    # Remove same date to make reruns idempotent.
    base = [r for r in base if r.get('Fecha') != date_str]
    previous_dates = sorted({r.get('Fecha') for r in base if r.get('Fecha') and r.get('Fecha') < date_str})
    prev_date = previous_dates[-1] if previous_dates else None
    prev_by_name = {normalize_name(r.get('Participante')): r for r in base if r.get('Fecha') == prev_date} if prev_date else {}

    leader_points = max(r['Puntos'] for r in latest_rows)
    new_rows = []
    for row in latest_rows:
        prev = prev_by_name.get(row['Participante'])
        puntos_dia = None if prev is None else row['Puntos'] - int(prev.get('Puntos') or 0)
        cambio = None if prev is None else int(prev.get('Posicion') or row['Posicion']) - row['Posicion']
        new_rows.append({
            'Fecha': date_str,
            'Participante': row['Participante'],
            'Posicion': row['Posicion'],
            'Puntos': row['Puntos'],
            'Puntos_Dia': puntos_dia,
            'Distancia_Lider': leader_points - row['Puntos'],
            'Cambio_Posicion': cambio,
        })

    current['base'] = sorted(base + new_rows, key=lambda r: (r.get('Fecha',''), int(r.get('Posicion') or 9999)))
    rebuild_derived(current)


def rebuild_derived(data: Dict[str, Any]) -> None:
    base = data.get('base', [])
    dates = sorted({r['Fecha'] for r in base})
    movers = []
    leader_days: Dict[str, int] = {}
    for d in dates:
        rows = [r for r in base if r['Fecha'] == d]
        if not rows:
            continue
        leader = min(rows, key=lambda r: int(r.get('Posicion') or 9999))
        leader_days[leader['Participante']] = leader_days.get(leader['Participante'], 0) + 1
        changes = [r for r in rows if r.get('Cambio_Posicion') is not None]
        up = max(changes, key=lambda r: r['Cambio_Posicion'], default=None)
        down = min(changes, key=lambda r: r['Cambio_Posicion'], default=None)
        if up or down:
            movers.append({
                'Fecha': d,
                'Mayor_Subida': up['Participante'] if up else None,
                'Puestos_Subidos': up['Cambio_Posicion'] if up else None,
                'Mayor_Bajada': down['Participante'] if down else None,
                'Puestos_Bajados': down['Cambio_Posicion'] if down else None,
                'Lider': leader['Participante'],
                'Puntos_Lider': leader['Puntos'],
            })
    data['movers'] = movers
    data['leaders'] = sorted([
        {'Participante': k, 'Dias_Lider': v} for k,v in leader_days.items()
    ], key=lambda r: (-r['Dias_Lider'], r['Participante']))

    latest_date = dates[-1] if dates else None
    latest = [r for r in base if r['Fecha'] == latest_date]
    first_date = dates[0] if dates else None
    first = {r['Participante']: r for r in base if r['Fecha'] == first_date}
    if latest:
        leader = min(latest, key=lambda r: int(r.get('Posicion') or 9999))
        climbs = []
        for r in latest:
            f = first.get(r['Participante'])
            if f:
                climbs.append({'name': r['Participante'], 'positions': int(f['Posicion']) - int(r['Posicion'])})
        biggest_up = max(climbs, key=lambda x: x['positions'], default={'name': None, 'positions': 0})
        biggest_down = min(climbs, key=lambda x: x['positions'], default={'name': None, 'positions': 0})
        data['summary'] = {
            'updated': latest_date,
            'leader': leader['Participante'],
            'leader_points': leader['Puntos'],
            'participants': len(latest),
            'days': len(dates),
            'biggest_total_climb': biggest_up,
            'biggest_total_drop': biggest_down,
        }


def update_email(data: Dict[str, Any], email: Dict[str, Any]) -> None:
    data['email'] = {
        'subject': email.get('subject', ''),
        'from': email.get('from', ''),
        'sent': email.get('sent', ''),
        'attachment': email.get('attachment', ''),
        'body': email.get('bodyText', ''),
    }


def main() -> None:
    if not XLSX.exists():
        raise FileNotFoundError('Missing inbox/latest.xlsx')
    email = json.loads(EMAIL_JSON.read_text(encoding='utf-8')) if EMAIL_JSON.exists() else {}
    msg_id = email.get('messageId', '')
    processed = set(PROCESSED.read_text(encoding='utf-8').splitlines()) if PROCESSED.exists() else set()
    # Idempotency: if data.js already has this email subject/attachment, allow no-op safely.

    data = load_current()
    latest_date = infer_date(email)
    latest_rows = find_ranking_table(XLSX)
    compute_new_snapshot(data, latest_rows, latest_date)
    update_email(data, email)
    save_data(data)

    if msg_id and msg_id not in processed:
        with PROCESSED.open('a', encoding='utf-8') as f:
            f.write(msg_id + '\n')

    print(f'Updated Polla data for {latest_date}: {len(latest_rows)} participants, leader {data["summary"]["leader"]} ({data["summary"]["leader_points"]} pts)')


if __name__ == '__main__':
    main()

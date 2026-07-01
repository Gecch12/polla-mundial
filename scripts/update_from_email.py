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
    """Extract the official ranking table from Beto's PUNTAJES sheet.

    The real ranking is the table at the far right of the sheet, shaped like:
      TOTAL | <position> | <participant name>
       237 |      1     | SALVADOR RAMOS

    We avoid generic table detection because the sheet contains many other
    numeric areas that can look like rankings.
    """
    from openpyxl import load_workbook

    wb = load_workbook(xlsx_path, data_only=True, read_only=True)
    sheet_name = None
    for name in wb.sheetnames:
        if 'PUNTAJES' in normalize_name(name):
            sheet_name = name
            break
    if sheet_name is None:
        # Fallback, but still scan every sheet using the same strict pattern.
        sheets = wb.sheetnames
    else:
        sheets = [sheet_name] + [n for n in wb.sheetnames if n != sheet_name]

    all_candidates: List[Dict[str, Any]] = []

    def cell_num(v: Any) -> Optional[float]:
        return to_number(v)

    def valid_name(v: Any) -> str:
        name = normalize_name(v)
        if len(name) < 3:
            return ''
        bad = [
            'TOTAL', 'PUNTOS', 'PUESTOS', 'PARTICIPANTE', 'CLASIF', 'ETAPA',
            'GRUPO', 'REGLAMENTO', 'FECHA', 'FINAL', 'OCTAVOS', 'DIECISEISAVOS',
            'PERU', 'MUNDIAL', 'PUESTO'
        ]
        if any(b in name for b in bad):
            return ''
        # Names should contain letters; avoid random formulas/URLs.
        if not re.search(r'[A-ZÁÉÍÓÚÑ]', name):
            return ''
        return name

    for sh_name in sheets:
        ws = wb[sh_name]
        max_row = ws.max_row or 0
        max_col = ws.max_column or 0
        if max_row < 10 or max_col < 5:
            continue

        # Pattern A: TOTAL column, then rank, then participant name.
        # This matches the official right-side ranking in the workbook.
        for total_col in range(1, max_col - 1):
            rows: List[Dict[str, Any]] = []
            for r in range(1, max_row + 1):
                pts = cell_num(ws.cell(r, total_col).value)
                pos = cell_num(ws.cell(r, total_col + 1).value)
                name = valid_name(ws.cell(r, total_col + 2).value)
                if pts is None or pos is None or not name:
                    continue
                if not (1 <= int(pos) <= 250):
                    continue
                if not (120 <= int(pts) <= 1000):
                    continue
                rows.append({'Participante': name, 'Puntos': int(round(pts)), 'Posicion': int(round(pos))})

            if len(rows) >= 50:
                # Score prefers many rows, high leader score, and a plausible first-position row.
                leader = max(r['Puntos'] for r in rows)
                has_pos1 = any(r['Posicion'] == 1 for r in rows)
                score = len(rows) * 1000 + leader + (5000 if has_pos1 else 0)
                all_candidates.append({'score': score, 'rows': rows, 'sheet': sh_name, 'pattern': f'{total_col},{total_col+1},{total_col+2}'})

        # Pattern B: rank, name, total points in nearby columns. Kept as fallback.
        for pos_col in range(1, max_col - 1):
            rows = []
            for r in range(1, max_row + 1):
                pos = cell_num(ws.cell(r, pos_col).value)
                name = valid_name(ws.cell(r, pos_col + 1).value)
                if pos is None or not name or not (1 <= int(pos) <= 250):
                    continue
                # Look up to 4 columns left/right for a plausible total.
                pts = None
                for c in list(range(max(1, pos_col - 4), pos_col)) + list(range(pos_col + 2, min(max_col, pos_col + 6) + 1)):
                    n = cell_num(ws.cell(r, c).value)
                    if n is not None and 120 <= int(n) <= 1000:
                        pts = int(round(n))
                        break
                if pts is None:
                    continue
                rows.append({'Participante': name, 'Puntos': pts, 'Posicion': int(round(pos))})
            if len(rows) >= 50:
                leader = max(r['Puntos'] for r in rows)
                score = len(rows) * 900 + leader + (3000 if any(r['Posicion'] == 1 for r in rows) else 0)
                all_candidates.append({'score': score, 'rows': rows, 'sheet': sh_name, 'pattern': f'fallback {pos_col}'})

    if not all_candidates:
        raise ValueError('No pude encontrar la tabla oficial de ranking en la hoja PUNTAJES. No se publica nada.')

    chosen = max(all_candidates, key=lambda x: x['score'])
    rows = chosen['rows']

    # De-duplicate by participant, keeping the row with the highest points.
    dedup: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        name = row['Participante']
        if name not in dedup or row['Puntos'] > dedup[name]['Puntos']:
            dedup[name] = row
    rows = list(dedup.values())

    # Sort by official position first when available; tie with points/name.
    rows.sort(key=lambda r: (int(r.get('Posicion') or 9999), -int(r['Puntos']), r['Participante']))

    # Hard validations to prevent publishing a corrupted parse.
    if len(rows) < 70:
        raise ValueError(f'Validación fallida: solo se extrajeron {len(rows)} participantes. No se publica.')
    if rows[0]['Puntos'] < 150:
        raise ValueError(f'Validación fallida: líder con {rows[0]["Puntos"]} puntos parece incorrecto. No se publica.')
    if rows[0]['Participante'] in {'TERCEROS', 'TOTAL', 'PUNTOS'}:
        raise ValueError('Validación fallida: el líder extraído no es un participante real. No se publica.')
    if rows[0]['Puntos'] < rows[1]['Puntos']:
        raise ValueError('Validación fallida: ranking no está ordenado por puntos. No se publica.')

    print(f'Ranking oficial extraído de hoja {chosen["sheet"]}, columnas {chosen["pattern"]}: {len(rows)} participantes. Líder {rows[0]["Participante"]} {rows[0]["Puntos"]}.')
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

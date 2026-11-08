"""The video spec for the 2026 São Paulo qualifying recap: tables from OpenF1
(session_result's Q1/Q2/Q3 times, drivers' team colours), the story from race
control and the FIA's and Sky Sports' reports, checked against the data.

  python3 quali_sao_paulo_2026.py OPENF1.json SPEC.json
OPENF1.json: {"result": session_result, "drivers": drivers} of the session.
"""
import json, os, sys

UK = {  # surnames as Ukrainian readers know them
    "NOR": "Норріс", "RUS": "Расселл", "ANT": "Антонеллі", "LEC": "Леклер", "LAW": "Лоусон", "HUL": "Гюлькенберг",
    "HAD": "Аджар", "BEA": "Берман", "ALO": "Алонсо", "ALB": "Албон", "HAM": "Хемілтон", "PIA": "Піастрі",
    "CAM": "Камара", "LIN": "Ліндблад", "SAI": "Сайнс", "VER": "Ферстаппен", "COL": "Колапінто", "GAS": "Гаслі",
    "STR": "Стролл", "BOT": "Боттас", "PER": "Перес", "BOR": "Бортолето",
}

src = json.load(open(sys.argv[1]))
drv = {d["driver_number"]: d for d in src["drivers"]}
res = src["result"]


def fmt(sec):
    if sec is None:
        return "без часу"
    m, s = divmod(sec, 60)
    return f"{int(m)}:{s:06.3f}"


def row(r, q, pos, mark=None, note=None):
    d = drv[r["driver_number"]]
    t = (r.get("duration") or [None, None, None])[q]
    out = {"pos": str(pos), "code": d["name_acronym"], "name": UK.get(d["name_acronym"], d["last_name"]), "colour": "#" + (d.get("team_colour") or "888888"), "time": fmt(t)}
    if mark:
        out["mark"] = mark
    if note:
        out["note"] = note
    return out


def part(q, size, keep):
    """Rows of one part: everyone who ran it, by that part's time; the last ones out."""
    ran = [r for r in res if (r.get("position") or 99) <= size]
    ran.sort(key=lambda r: ((r.get("duration") or [None] * 3)[q] or 999, r["position"]))
    return ran


code = lambda r: drv[r["driver_number"]]["name_acronym"]

q1 = part(0, 22, 16)
q1_rows = [row(r, 0, i + 1, "out" if i >= 16 else None, "відбійник" if code(r) == "BOR" else None) for i, r in enumerate(q1)]
q2 = part(1, 16, 10)
q2_notes = {"VER": "не виїхав", "CAM": "відбійник", "LIN": "техпроблема"}
q2_rows = [row(r, 1, i + 1, "out" if i >= 10 else None, q2_notes.get(code(r))) for i, r in enumerate(q2)]
q3 = part(2, 10, 1)
q3_rows = [row(r, 2, i + 1, "pole" if i == 0 else None) for i, r in enumerate(q3)]
by = {code(r): r for r in res}
col = lambda c: "#" + (drv[by[c]["driver_number"]].get("team_colour") or "888888")

outline = json.load(open(os.path.join(os.path.dirname(__file__), "../../server/src/data/circuit-outlines.json")))["circuits"]["interlagos"]

spec = {
    "session": "Кваліфікація",
    "place": "Гран-прі Сан-Паулу 2026",
    "outline": {"d": outline["d"], "w": float(outline["w"]), "h": float(outline["h"])},
    "scenes": [
        {"kind": "title", "dur": 4.2, "kicker": "ГРАН-ПРІ САН-ПАУЛУ",
         "lines": ["ЗЛИВА.", "ДВА ЧЕРВОНІ", "ПРАПОРИ.", "0,204 С"], "accent": 3, "sub": "Одна з найхаотичніших кваліфікацій сезону"},
        {"kind": "clock", "dur": 6.5, "title": "Злива", "wipe": "#e10600", "label": "ЧЕРВОНИЙ ПРАПОР", "from": 0, "to": 5017,
         "caption": "стільки трасу тримали закритою",
         "note": "Прапор показали через 2 хв 23 с після старту Q1, ще до першого швидкого кола."},
        {"kind": "table", "dur": 9.5, "title": "Q1", "wipe": col("BOR"), "sub": "вибувають 6",
         "rows": q1_rows, "notes": ["9 кіл видалено", "Бортолето у відбійнику"]},
        {"kind": "table", "dur": 9.0, "title": "Q2", "wipe": col("LAW"), "sub": "вибувають 6",
         "rows": q2_rows, "notes": ["Лоусон першим на проміжних", "Аварія Камари: Q2 не відновили"]},
        {"kind": "table", "dur": 7.5, "title": "Q3", "wipe": col("ALO"), "sub": "топ-10",
         "rows": q3_rows, "notes": ["Алонсо: перше Q3 для Aston Martin у сезоні"]},
        {"kind": "big", "dur": 6.5, "title": "Поул", "wipe": col("NOR"), "value": "0,204", "caption": "секунди між поулом і другим місцем",
         "number": "1", "colour": col("NOR"),
         "left": row(by["NOR"], 2, 1, "pole"), "right": row(by["RUS"], 2, 2),
         "note": "Расселлу наказали перервати коло за Албоном. Потім посилився дощ, і кращого шансу вже не було."},
        {"kind": "list", "dur": 7.5, "title": "Штрафи на решітці", "wipe": col("RUS"),
         "items": [
             {"colour": col("RUS"), "head": "Расселл  −5", "text": "заміна двигуна: стартує 7-м"},
             {"colour": col("LEC"), "head": "Леклер  −10", "text": "заміна двигуна: стартує 14-м"},
             {"colour": col("HAM"), "head": "Хемілтон", "text": "нова силова установка: з кінця решітки"},
             {"colour": col("VER"), "head": "Ферстаппен", "text": "нова силова установка: з кінця решітки"},
             {"colour": col("PER"), "head": "Перес", "text": "Cadillac: з кінця решітки"},
         ]},
        {"kind": "table", "dur": 8.0, "title": "Стартова решітка", "wipe": col("LAW"), "sub": "топ-10",
         "rows": [dict(row(by[c], 2, i + 1), time="") for i, c in enumerate(["NOR", "ANT", "LAW", "HUL", "HAD", "BEA", "RUS", "ALO", "ALB", "PIA"])],
         "notes": ["Лоусон 3-й: повторює свій рекорд у кар'єрі", "Хемілтон 20-й, Ферстаппен 21-й"]},
        {"kind": "outro", "dur": 4.5, "wipe": "#e10600", "lines": ["Повний розбір", "paddocktimes.com"],
         "sub": "Гонка сьогодні о 19:00 · Telegram @paddocktimes",
         "credit": "Дані: OpenF1, FIA. Схема траси: f1-circuits (MIT). Paddock Times не пов'язаний з Formula 1."},
    ],
}
spec["scenes"][7]["rows"][0]["mark"] = "pole"  # the grid shows the starting slot: P1 gets the highlight
json.dump(spec, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
print("scenes", len(spec["scenes"]), "seconds", round(sum(s["dur"] for s in spec["scenes"]), 1))

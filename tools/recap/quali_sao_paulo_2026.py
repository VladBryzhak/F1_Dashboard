"""The video spec for the 2026 São Paulo qualifying recap: tables from OpenF1
(session_result's Q1/Q2/Q3 times, drivers' team colours), the story from race
control and the FIA's and Sky Sports' reports, checked against the data.

  python3 quali_sao_paulo_2026.py OPENF1.json SPEC.json
OPENF1.json: {"result": session_result, "drivers": drivers} of the session.
"""
import json, sys

UK = {  # surnames as Ukrainian readers know them
    "NOR": "Норріс", "RUS": "Расселл", "ANT": "Антонеллі", "LEC": "Леклер", "LAW": "Лоусон", "HUL": "Гюлькенберг",
    "HAD": "Аджар", "BEA": "Берман", "ALO": "Алонсо", "ALB": "Албон", "HAM": "Гамільтон", "PIA": "Піастрі",
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

spec = {
    "kicker": "КВАЛІФІКАЦІЯ · САН-ПАУЛУ 2026",
    "scenes": [
        {"kind": "title", "dur": 4.2, "chapter": "Розділ 1/8 · коротко", "kicker": "ГРАН-ПРІ САН-ПАУЛУ",
         "lines": ["ЗЛИВА.", "2 ЧЕРВОНІ", "ПРАПОРИ.", "0,204 С"], "accent": 3, "sub": "Одна з найхаотичніших кваліфікацій сезону"},
        {"kind": "clock", "dur": 6.5, "chapter": "Розділ 2/8 · злива", "label": "ЧЕРВОНИЙ ПРАПОР", "from": 0, "to": 5017,
         "caption": "стільки трасу тримали закритою",
         "note": "Прапор показали через 2 хв 23 с після старту Q1, ще до першого швидкого кола."},
        {"kind": "table", "dur": 9.5, "chapter": "Розділ 3/8 · Q1", "title": "Q1", "sub": "вибувають 6",
         "rows": q1_rows, "notes": ["9 кіл видалено", "Бортолето у відбійнику"]},
        {"kind": "table", "dur": 9.0, "chapter": "Розділ 4/8 · Q2", "title": "Q2", "sub": "вибувають 6",
         "rows": q2_rows, "notes": ["Лоусон першим на проміжних", "Аварія Камари: Q2 не відновили"]},
        {"kind": "table", "dur": 7.5, "chapter": "Розділ 5/8 · Q3", "title": "Q3", "sub": "топ-10",
         "rows": q3_rows, "notes": ["Алонсо: перше Q3 для Aston Martin у сезоні"]},
        {"kind": "big", "dur": 6.5, "chapter": "Розділ 6/8 · поул", "value": "0,204", "caption": "секунди між поулом і другим місцем",
         "left": row(by["NOR"] if "NOR" in by else q3[0], 2, 1, "pole"), "right": row(by["RUS"], 2, 2),
         "note": "Расселлу наказали перервати коло за Албоном. Потім посилився дощ, і кращого шансу вже не було."},
        {"kind": "list", "dur": 7.5, "chapter": "Розділ 7/8 · штрафи", "title": "ШТРАФИ НА РЕШІТЦІ",
         "items": [
             {"colour": col("RUS"), "head": "Расселл  −5", "text": "заміна двигуна: стартує 7-м"},
             {"colour": col("LEC"), "head": "Леклер  −10", "text": "заміна двигуна: стартує 14-м"},
             {"colour": col("HAM"), "head": "Гамільтон", "text": "нова силова установка: з кінця решітки"},
             {"colour": col("VER"), "head": "Ферстаппен", "text": "нова силова установка: з кінця решітки"},
             {"colour": col("PER"), "head": "Перес", "text": "Cadillac: з кінця решітки"},
         ]},
        {"kind": "table", "dur": 8.0, "chapter": "Розділ 8/8 · старт", "title": "СТАРТОВА РЕШІТКА", "sub": "топ-10",
         "rows": [dict(row(by[c], 2, i + 1), time="") for i, c in enumerate(["NOR", "ANT", "LAW", "HUL", "HAD", "BEA", "RUS", "ALO", "ALB", "PIA"])],
         "notes": ["Лоусон 3-й: повторює свій рекорд у кар'єрі", "Гамільтон 20-й, Ферстаппен 21-й"]},
        {"kind": "outro", "dur": 4.5, "chapter": "Гонка сьогодні о 19:00", "lines": ["ПОВНИЙ РОЗБІР", "paddocktimes.com"],
         "sub": "Telegram: @paddocktimes", "credit": "Дані: OpenF1, FIA. Paddock Times не пов'язаний з Formula 1."},
    ],
}
# the grid rows show the starting slot, so the pole highlight goes to P1
spec["scenes"][7]["rows"][0]["mark"] = "pole"
json.dump(spec, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
print("scenes", len(spec["scenes"]), "seconds", round(sum(s["dur"] for s in spec["scenes"]), 1))

"""Download two laps for a ghost-lap video, plus the session's other fast laps
(they show where the track runs and how wide it is).

  python3 fetch.py OUT_DIR A B
  A, B = "<year>:<location>:<session>:<driver number>[:pole]"
  e.g. "2025:São Paulo:Qualifying:4:pole"

":pole" takes the lap the driver set their last qualifying time with (Q3 if
they reached it), not just their fastest lap of the session. Data: OpenF1
(free tier: 3 requests a second, 30 a minute, so this paces itself).
"""
import json, os, sys, time, urllib.parse, urllib.request
from datetime import datetime, timedelta

BASE = "https://api.openf1.org/v1"
_last = [0.0]


def get(path):
    for attempt in range(6):
        wait = 2.1 - (time.time() - _last[0])  # stays under 30 a minute
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            with urllib.request.urlopen(BASE + path, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:  # OpenF1's answer for "nothing found"
                return []
            if e.code in (429, 503):
                time.sleep(5 * (attempt + 1))
                continue
            raise
    raise RuntimeError("OpenF1 kept refusing " + path)


def session_key(year, location, name):
    q = urllib.parse.urlencode({"year": year, "location": location, "session_name": name})
    s = get("/sessions?" + q)
    if not s:
        raise SystemExit(f"no {name} session at {location} {year}")
    return s[0]["session_key"]


def window(lap, pad=0.8):
    st = datetime.fromisoformat(lap["date_start"]) - timedelta(seconds=pad)
    en = datetime.fromisoformat(lap["date_start"]) + timedelta(seconds=lap["lap_duration"] + pad)
    return f"date>={st.isoformat()}&date<={en.isoformat()}".replace("+00:00", "")


def pick_lap(key, num, pole):
    laps = [l for l in get(f"/laps?session_key={key}&driver_number={num}") if l.get("lap_duration") and l.get("date_start")]
    if not laps:
        raise SystemExit(f"no timed laps for car {num}")
    if pole:
        res = [r for r in get(f"/session_result?session_key={key}&driver_number={num}")]
        d = res[0].get("duration") if res else None
        parts = [x for x in (d if isinstance(d, list) else [d]) if x]
        if parts:
            target = parts[-1]
            return min(laps, key=lambda l: abs(l["lap_duration"] - target))
    return min(laps, key=lambda l: l["lap_duration"])


def lap_data(key, num, lap):
    w = window(lap)
    d = get(f"/drivers?session_key={key}&driver_number={num}")[0]
    return {
        "start": lap["date_start"],
        "duration": lap["lap_duration"],
        "sectors": [lap.get("duration_sector_1"), lap.get("duration_sector_2"), lap.get("duration_sector_3")],
        "number": num,
        "code": d["name_acronym"],
        "name": d["full_name"],
        "team": d["team_name"],
        "colour": "#" + (d.get("team_colour") or "ffffff"),
        "loc": get(f"/location?session_key={key}&driver_number={num}&{w}"),
        "car": get(f"/car_data?session_key={key}&driver_number={num}&{w}"),
    }


def main():
    out, a, b = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(out, exist_ok=True)
    keys = {}
    for tag, spec in (("a", a), ("b", b)):
        year, location, session, num, *rest = spec.split(":")
        key = session_key(int(year), location, session)
        keys[tag] = key
        lap = pick_lap(key, int(num), "pole" in rest)
        data = lap_data(key, int(num), lap) | {"year": int(year), "location": location, "session": session}
        json.dump(data, open(os.path.join(out, f"lap_{tag}.json"), "w"))
        print(tag, data["code"], data["team"], data["duration"], len(data["loc"]), "points")

    # The track: every driver's fastest lap of session A.
    key = keys["a"]
    track = []
    for d in get(f"/drivers?session_key={key}"):
        laps = [l for l in get(f"/laps?session_key={key}&driver_number={d['driver_number']}") if l.get("lap_duration") and l.get("date_start")]
        if not laps:
            continue
        best = min(laps, key=lambda l: l["lap_duration"])
        pts = get(f"/location?session_key={key}&driver_number={d['driver_number']}&{window(best, 0)}")
        track.append([[p["x"], p["y"], p["z"]] for p in pts if p["x"] or p["y"]])
        print("track lap", d["name_acronym"], len(pts))
    json.dump(track, open(os.path.join(out, "track.json"), "w"))


if __name__ == "__main__":
    main()

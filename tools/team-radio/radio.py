"""Team radio for the race replay, made on this Mac (not part of the site's build).

    radio.py draft <session_key>    download the session's clips from OpenF1, find the
                                    speech turns, tell the driver's voice from the
                                    engineer's and transcribe every turn: writes
                                    drafts/<session_key>.json and .txt for review
    radio.py enroll <session_key>   after the reviewed file is in
                                    server/src/data/team-radio/<session_key>.json, learn
                                    each driver's and engineer's voice from it, so the
                                    next sessions split voices better

The review (fixing who speaks, names and unclear words, and the Ukrainian
translation) is done by hand, from the draft, into the file the site serves.
See tools/team-radio/README.md.
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

import numpy as np
import soundfile as sf
import torch
from silero_vad import get_speech_timestamps, load_silero_vad
from sklearn.cluster import AgglomerativeClustering
from speechbrain.inference.speaker import EncoderClassifier

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
DRAFTS = os.path.join(HERE, "drafts")
PUBLISHED = os.path.join(REPO, "server", "src", "data", "team-radio")
HOME = os.path.expanduser("~/.local/share/paddock-radio")
CACHE = os.path.expanduser("~/.cache/paddock-radio")
VOICES = os.path.join(HOME, "voices.json")
WHISPER_MODEL = os.path.expanduser("~/.local/share/whisper/ggml-large-v3-turbo.bin")
OPENF1 = "https://api.openf1.org/v1"
SR = 16000

# Engine noise and the radio's own crackle sit outside the voice band; the
# rest is levelled so quiet and shouted words read alike.
CLEAN = "highpass=f=180,lowpass=f=4200,afftdn=nf=-28,dynaudnorm=f=150:g=15"
TERMS = ("Box, box. Safety car, virtual safety car, DRS, delta, push, tyres, softs, mediums, hards, inters, "
         "five-second penalty, stewards, track limits, P1, copy.")
# A voice must be this much closer to one of the known voices to be taken
# for it; closer calls are left to the clustering and the review.
MARGIN = 0.05


def openf1(path):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(f"{OPENF1}/{path}", timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < 3:
                time.sleep(2 + attempt * 3)
                continue
            raise SystemExit(f"OpenF1 {path}: {e} (results open 30 min after a session ends)")


def ffmpeg(src, dst, filters=None):
    args = ["ffmpeg", "-loglevel", "error", "-y", "-i", src]
    if filters:
        args += ["-af", filters]
    subprocess.run(args + ["-ar", str(SR), "-ac", "1", dst], check=True)


def download(session_key, clips):
    """mp3s into the cache (never into the repo), as 16 kHz mono WAVs, plain and cleaned."""
    base = os.path.join(CACHE, str(session_key))
    os.makedirs(base, exist_ok=True)
    for c in clips:
        name = os.path.basename(c["recording_url"])[:-4]
        mp3, raw, clean = (os.path.join(base, f"{name}{ext}") for ext in (".mp3", ".raw.wav", ".clean.wav"))
        if not os.path.exists(mp3):
            urllib.request.urlretrieve(c["recording_url"], mp3)
        if not os.path.exists(clean):
            ffmpeg(mp3, raw)
            ffmpeg(raw, clean, CLEAN)
        c["id"] = name
        c["clean"] = clean
    return base


class Models:
    def __init__(self):
        self.vad = load_silero_vad()
        self.enc = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb",
                                                  savedir=os.path.join(HOME, "models", "ecapa"))

    def regions(self, x):
        ts = get_speech_timestamps(torch.from_numpy(x), self.vad, sampling_rate=SR, min_silence_duration_ms=200,
                                   speech_pad_ms=80, return_seconds=True)
        return [(float(t["start"]), float(t["end"])) for t in ts]

    def embed(self, x, a, b):
        # A short turn borrows a little sound either side.
        if b - a < 1.0:
            pad = (1.0 - (b - a)) / 2
            a, b = max(0.0, a - pad), min(len(x) / SR, b + pad)
        seg = x[int(a * SR):int(b * SR)]
        with torch.no_grad():
            e = self.enc.encode_batch(torch.from_numpy(seg).unsqueeze(0)).squeeze().cpu().numpy()
        return e / np.linalg.norm(e)


def transcribe(x, a, b, prompt):
    seg = x[max(0, int((a - 0.15) * SR)):int((b + 0.15) * SR)]
    with tempfile.TemporaryDirectory() as t:
        sf.write(os.path.join(t, "s.wav"), seg, SR)
        subprocess.run(["whisper-cli", "-m", WHISPER_MODEL, "-l", "en", "-bs", "5", "--prompt", prompt, "-np",
                        "-ojf", "-of", os.path.join(t, "s"), "-f", os.path.join(t, "s.wav")],
                       check=True, capture_output=True)
        with open(os.path.join(t, "s.json")) as f:
            d = json.load(f)
    toks = [k for s in d["transcription"] for k in s["tokens"] if not k["text"].startswith("[")]
    text = " ".join(s["text"].strip() for s in d["transcription"]).strip()
    words = [k["text"].strip() for k in toks if k["p"] < 0.4 and k["text"].strip().isalpha()]
    return text, (float(np.mean([k["p"] for k in toks])) if toks else 0.0), words


def load_voices():
    try:
        with open(VOICES) as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def label_driver(turns, first_name, known):
    """driver / engineer for each turn of one driver's clips."""
    if known and known.get("driver") and known.get("engineer"):
        drv, eng = np.array(known["driver"]), np.array(known["engineer"])
        for t in turns:
            sd, se = float(t["emb"] @ drv), float(t["emb"] @ eng)
            t["who"] = "driver" if sd - se > MARGIN else "engineer" if se - sd > MARGIN else None
            t["how"] = "voiceprint"
        return
    if len(turns) < 3:
        for t in turns:
            t["who"], t["how"] = None, "too few turns"
        return
    lab = AgglomerativeClustering(n_clusters=2, metric="cosine", linkage="average").fit_predict(
        np.stack([t["emb"] for t in turns]))
    # The engineer is the voice that calls the driver by name.
    calls = [sum(first_name.lower() in t["text"].lower() for t, l in zip(turns, lab) if l == v) for v in (0, 1)]
    eng = int(np.argmax(calls)) if calls[0] != calls[1] else None
    for t, l in zip(turns, lab):
        t["who"] = None if eng is None else ("engineer" if l == eng else "driver")
        t["how"] = f"voice {l}"


def draft(session_key):
    clips = openf1(f"team_radio?session_key={session_key}")
    if not clips:
        raise SystemExit("No team radio for this session (yet).")
    drivers = {d["driver_number"]: d for d in openf1(f"drivers?session_key={session_key}")}
    session = (openf1(f"sessions?session_key={session_key}") or [{}])[0]
    download(session_key, clips)
    names = ", ".join(sorted({n for d in drivers.values() for n in (d.get("first_name"), d.get("last_name")) if n}))
    prompt = f"Formula 1 team radio. {names}. {TERMS}"
    m = Models()
    voices = load_voices()

    by_driver = {}
    for c in clips:
        by_driver.setdefault(c["driver_number"], []).append(c)
    out = []
    for num, cl in sorted(by_driver.items()):
        d = drivers.get(num, {})
        code = d.get("name_acronym", str(num))
        turns = []
        for c in sorted(cl, key=lambda c: c["date"]):
            x, _ = sf.read(c["clean"], dtype="float32")
            regs = m.regions(x)
            for a, b in regs:
                turns.append({"clip": c["id"], "a": a, "b": b, "emb": m.embed(x, a, b), "x": x})
        # Transcribe each region on its own, so its words are its speaker's.
        for t in turns:
            t["text"], t["p"], t["unsure"] = transcribe(t["x"], t["a"], t["b"], prompt)
        label_driver(turns, d.get("first_name") or "", voices.get(code))
        for c in sorted(cl, key=lambda c: c["date"]):
            mine = [t for t in turns if t["clip"] == c["id"]]
            lines = []
            for t in mine:
                # Consecutive regions of the same speaker make one line.
                if lines and lines[-1]["who"] == t["who"] and t["who"] is not None and t["a"] - lines[-1]["to"] < 0.8:
                    lines[-1]["to"] = round(t["b"], 2)
                    lines[-1]["en"] += " " + t["text"]
                    lines[-1]["p"] = min(lines[-1]["p"], round(t["p"], 2))
                    lines[-1]["unsure"] += t["unsure"]
                else:
                    lines.append({"who": t["who"], "from": round(t["a"], 2), "to": round(t["b"], 2), "en": t["text"],
                                  "p": round(t["p"], 2), "unsure": t["unsure"], "how": t["how"]})
            out.append({"id": c["id"], "driverNumber": num, "code": code, "date": c["date"],
                        "url": c["recording_url"], "lines": lines})
        print(f"{code}: {len(cl)} clips, {len(turns)} turns")

    os.makedirs(DRAFTS, exist_ok=True)
    meta = {"sessionKey": int(session_key), "sessionName": session.get("session_name"),
            "location": session.get("location"), "year": session.get("year"), "clips": out}
    with open(os.path.join(DRAFTS, f"{session_key}.json"), "w") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    with open(os.path.join(DRAFTS, f"{session_key}.txt"), "w") as f:
        for c in sorted(out, key=lambda c: c["date"]):
            f.write(f"\n== {c['id']}  {c['date'][11:19]}\n")
            for ln in c["lines"]:
                flag = f"  [unsure: {', '.join(ln['unsure'])}]" if ln["unsure"] else ""
                f.write(f"  {ln['who'] or '?':8} {ln['from']:5.1f}-{ln['to']:5.1f} p{ln['p']:.2f}  {ln['en']}{flag}\n")
    print(f"Draft: tools/team-radio/drafts/{session_key}.json (+ .txt to read)")


def enroll(session_key):
    """Average each confirmed driver's and engineer's voice into voices.json."""
    with open(os.path.join(PUBLISHED, f"{session_key}.json")) as f:
        published = json.load(f)
    clips = openf1(f"team_radio?session_key={session_key}")
    download(session_key, clips)
    path = {c["id"]: c["clean"] for c in clips}
    m = Models()
    voices = load_voices()
    for c in published["clips"]:
        x, _ = sf.read(path[c["id"]], dtype="float32")
        v = voices.setdefault(c["code"], {"driver": None, "engineer": None, "n": {"driver": 0, "engineer": 0}})
        # Only lines that are one speech turn of the draft carry their times;
        # lines split or joined in the review are left out.
        for ln in c.get("lines", []):
            if ln.get("who") not in ("driver", "engineer") or "from" not in ln or ln["to"] - ln["from"] < 0.8:
                continue
            e = m.embed(x, ln["from"], ln["to"])
            n = v["n"][ln["who"]]
            old = np.array(v[ln["who"]]) if v[ln["who"]] else np.zeros_like(e)
            mean = (old * n + e) / (n + 1)
            v[ln["who"]] = (mean / np.linalg.norm(mean)).tolist()
            v["n"][ln["who"]] = n + 1
    os.makedirs(HOME, exist_ok=True)
    with open(VOICES, "w") as f:
        json.dump(voices, f)
    print(f"Voices learnt for {len(voices)} drivers: {VOICES}")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("draft", "enroll") or not sys.argv[2].isdigit():
        raise SystemExit(__doc__)
    {"draft": draft, "enroll": enroll}[sys.argv[1]](sys.argv[2])

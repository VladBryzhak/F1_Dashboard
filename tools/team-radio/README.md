# Team radio (local tool)

Captions for the race replay's team radio, made on this Mac and committed as data. Nothing here runs on Render.

## What it does

`radio.py draft <session_key>` takes one session from OpenF1 and writes a draft for review.

1. It fetches the session's clips (`team_radio`), drivers and session details. These are the clips the broadcast aired.
2. It downloads the clips into `~/.cache/paddock-radio/<session_key>/` (never into the repo). It converts each clip to 16 kHz WAV, cleaned (`CLEAN`) for the speech models.
3. It finds the speech turns with Silero VAD.
4. It tells the driver's voice from the engineer's:
   - **known voices**: with a learnt voiceprint for both the driver and the engineer (`~/.local/share/paddock-radio/voices.json`), each turn goes to the closer one;
   - **otherwise**: the driver's turns are clustered into two voices (SpeechBrain ECAPA embeddings), and the voice that calls the driver by first name is the engineer.
5. It transcribes each turn on its own with whisper.cpp (`large-v3-turbo`, prompted with the session's driver names and F1 terms). It also notes the words the model wasn't sure of.
6. It writes `drafts/<session_key>.json` and a readable `drafts/<session_key>.txt`. Drafts are git-ignored.

## Review

Write the reviewed file by hand: `server/src/data/team-radio/<session_key>.json`. This is what the site serves. For each clip:

- **Speaker**: put the line on the right speaker (content helps: whoever gives gaps, penalties and strategy, or calls the driver by name, is the engineer). Leave `who` null when unsure.
- **Text**: fix names and terms, and put `…` for a word that can't be made out. A line or clip that can't be understood gets `"unclear": true`. Never guess.
- **Translation**: add the Ukrainian translation (`uk`) next to the English (`en`).
- **Times**: keep `from`/`to` (seconds into the clip) only on a line that is one of the draft's turns.

Then run `radio.py enroll <session_key>`. It learns the voices from the reviewed lines, so the next session splits them better.

## Setup (once)

```
brew install ffmpeg whisper-cpp python@3.12
curl -L -o ~/.local/share/whisper/ggml-large-v3-turbo.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin
/opt/homebrew/bin/python3.12 -m venv ~/.local/share/paddock-radio/venv
~/.local/share/paddock-radio/venv/bin/pip install -r tools/team-radio/requirements.txt
```

Run it with `~/.local/share/paddock-radio/venv/bin/python tools/team-radio/radio.py …`. OpenF1 opens a session's radio 30 minutes after it ends.

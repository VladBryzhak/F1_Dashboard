# Recap videos: a session in animated scenes

Vertical videos (1080×1920, 60 fps) that tell a qualifying or race in about a
minute: big type, a chapter bar with a clock, timing tables that build row by
row, the gap in huge figures, grid penalties, the starting grid, and the site
and channel at the end. Dark with red accents and a chequered band, in the
mood of Ukrainian F1 explainers on TikTok, in our own design. 2D only, so a
video renders in two or three minutes. No sound: add one in the app.

## Run

```sh
python3 quali_sao_paulo_2026.py OPENF1.json SPEC.json     # the story and tables for one session
../../server/node_modules/.bin/tsx recap.ts SPEC.json OUT.mp4 --fps 60
```

`recap.ts` draws whatever the spec says; `--png DIR --frames a-b` writes
single frames to check the layout. A spec is `{kicker, scenes}`, each scene
one of `title`, `clock`, `table`, `big`, `list`, `outro` (see the `Scene`
type at the top of `recap.ts`).

A session gets its own small builder script: tables come from OpenF1
(`session_result` for the Q1/Q2/Q3 times, `drivers` for team colours), the
story from race control and the official reports. Check every fact the way
articles are checked; penalties and the starting grid are not in OpenF1.

Needs ffmpeg and the server's node modules (`node_modules` here links to
them).

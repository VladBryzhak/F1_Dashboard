# Ghost lap: two real laps on one 3D track

A vertical video (1080×1920, 30 fps) for TikTok, Reels and the Telegram
channel: two laps from OpenF1 (2023 on) driven against each other on a 3D
model of the circuit, with the gap, sectors and both cars' telemetry over
it, a "who's faster?" opening and the result at the end.

Everything in the picture is ours: the track is built from the session's own
position data, the cars and scenery from code (`scene.py`), the boards carry
our own PADDOCK TIMES banner. No car models, liveries or photos from anyone
else. There is no sound: add one in the app you post with.

## Run

```sh
./make.sh ~/ghost/interlagos-2025-2023 \
  "2025:São Paulo:Qualifying:4:pole" "2023:São Paulo:Qualifying:1:pole" \
  "ПОУЛ ІНТЕРЛАГОС"
```

A spec is `<year>:<location as OpenF1 names it>:<session>:<car number>[:pole]`;
`:pole` takes the lap of the driver's last qualifying time (Q3), not just their
fastest of the session. The video lands in `WORK_DIR/ghost-lap.mp4`. Steps
already done (data, frames) are kept, so a run can be resumed.

Needs Blender (`/Applications/Blender.app`, or set `BLENDER`), ffmpeg and the
server's node modules (`npm install` at the repo root). OpenF1 refuses
requests from 30 minutes before a session to 30 minutes after it.

## How it works

- `fetch.py`: the two laps (positions and car data, about 4 a second) and
  every driver's fastest lap of session A. Paced under OpenF1's free limits.
- `scene.py` (Blender): the road is centred where the twenty cars ran and as
  wide as they used, with its real elevation; each car follows its own path
  through it (Catmull-Rom through its samples), so turn-in, apex and exit are
  where they really were. Kerbs and gravel on the corners, tyre walls,
  boards, fences, pit building, grandstands, trees, the city on the horizon.
  The chase camera sits behind whichever car is behind. `--still T` renders
  one frame at T seconds; `GHOST_SAMPLES` (default 8) and `GHOST_BLUR=1`
  (motion blur, 3-4x slower) set the quality.
- `hud.ts`: one transparent PNG per frame with the data; `banner.ts`: the
  boards' texture.
- `make.sh`: runs the steps and puts the frames together with ffmpeg.

Render time on an Apple silicon Mac: about 1.5 s a frame, so 50-60 minutes
for a 70-second lap.

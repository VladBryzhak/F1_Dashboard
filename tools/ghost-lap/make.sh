#!/bin/sh
# Ghost-lap video, start to finish (tools/ghost-lap/README.md).
#   ./make.sh WORK_DIR "A spec" "B spec" "TITLE"
# Specs as fetch.py takes them, e.g. "2025:São Paulo:Qualifying:4:pole".
set -e
cd "$(dirname "$0")"
WORK=$1 A=$2 B=$3 TITLE=$4
BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
TSX=../../server/node_modules/.bin/tsx
[ -e node_modules ] || ln -s ../../server/node_modules node_modules  # tsx and resvg for hud.ts, banner.ts
mkdir -p "$WORK/data" "$WORK/frames" "$WORK/hud"
[ -f "$WORK/data/lap_a.json" ] || python3 -I fetch.py "$WORK/data" "$A" "$B"
$TSX banner.ts "$WORK/data"
[ -f "$WORK/frames/frames.json" ] && [ "$(ls "$WORK/frames" | grep -c png)" -ge "$(python3 -c "import json;print(json.load(open('$WORK/frames/frames.json'))['frames'])")" ] \
  || "$BLENDER" -b --factory-startup --python scene.py -- "$WORK/data" "$WORK/frames" > "$WORK/render.log" 2>&1
$TSX hud.ts "$WORK/data" "$WORK/frames" "$WORK/hud" "$TITLE" 3
# Scene frames, the last one held for the result card, under the data layer.
ffmpeg -loglevel error -y -framerate 30 -i "$WORK/frames/%04d.png" -framerate 30 -i "$WORK/hud/%04d.png" \
  -filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=3[s];[s][1:v]overlay=shortest=1,format=yuv420p" \
  -c:v libx264 -preset slow -crf 18 -movflags +faststart "$WORK/ghost-lap.mp4"
echo "$WORK/ghost-lap.mp4"

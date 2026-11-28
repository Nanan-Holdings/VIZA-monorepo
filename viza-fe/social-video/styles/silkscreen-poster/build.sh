#!/bin/sh
# One command per video: Silkscreen Travel Poster style for a VIZA VideoSpec (1080x1920, 24 fps).
#   sh styles/silkscreen-poster/build.sh specs/<name>.json        → styles/silkscreen-poster/out/viza-<name>-silkscreen-poster.mp4
#   WORKERS=3 sh ...   more render workers (default 2)      STILLS=1 sh ...   also write a contact sheet of review stills
# Needs the Lemo-Opuscar library (LIB, default ~/lemo-opuscar) with its core deps (node, playwright browser, .venv), and ffmpeg 7+.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)                         # .../social-video/styles/silkscreen-poster
SV=$(cd "$HERE/../.." && pwd)                               # .../social-video
LIB=${LIB:-$HOME/lemo-opuscar}; export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the lemo-opuscar library folder"; exit 1; }
SPEC=${1:?usage: sh styles/silkscreen-poster/build.sh specs/<name>.json}
case "$SPEC" in /*) ;; *) [ -f "$SPEC" ] || SPEC="$SV/$SPEC";; esac
[ -f "$SPEC" ] || { echo "spec not found: $1"; exit 1; }
NAME=$(basename "$SPEC" .json)
SLUG=silkscreen-poster
WORKERS=${WORKERS:-2}
PY="$LIB/.venv/bin/python"
OUTD="$HERE/out/$NAME"; mkdir -p "$OUTD" "$HERE/content/brand"
T0=$(date +%s)

# fonts (OFL, Google Fonts repository) if missing
F="$HERE/fonts"
get() { [ -s "$F/$1" ] || { echo "fetching $1"; curl -fsSL --retry 3 -o "$F/$1" "https://github.com/google/fonts/raw/main/ofl/$2"; }; }
get BigShouldersDisplaywght.ttf 'bigshouldersdisplay/BigShouldersDisplay%5Bwght%5D.ttf'
get Outfitwght.ttf 'outfit/Outfit%5Bwght%5D.ttf'
get NotoSansSCwght.ttf 'notosanssc/NotoSansSC%5Bwght%5D.ttf'

# content: the spec, its voice (decoded to 48 kHz WAV for the mix) and the brand marks (used as drawn, never recoloured)
cp "$SPEC" "$HERE/content/$NAME.json"
VOICE=$("$PY" -c "import json,sys; print(json.load(open(sys.argv[1]))['voice'])" "$SPEC")
ffmpeg -v error -y -i "$SV/public/$VOICE" -ac 1 -ar 48000 "$OUTD/voice.wav"
cp "$SV"/public/brand/*.svg "$HERE/content/brand/"

cd "$LIB"
node core/render/events.mjs "$HERE" --q "spec=$NAME" --size 1080x1920 --out "$OUTD/events.json"
"$PY" "$HERE/mix.py" "$OUTD/events.json" "$OUTD/voice.wav" "$OUTD/mix.wav"
node core/render/video.mjs "$HERE" --q "spec=$NAME" --size 1080x1920 --fps 24 --workers "$WORKERS" --out "$OUTD/video.mp4"
sh core/render/mux.sh "$OUTD/video.mp4" "$OUTD/mix.wav" "$HERE/out/viza-$NAME-$SLUG.mp4" 24 1
node core/render/readcheck.mjs "$HERE" --q "spec=$NAME" --size 1080x1920 > "$OUTD/readcheck.txt" 2>&1 && echo "readcheck ok" || echo "readcheck: $(grep -vc '^OK' "$OUTD/readcheck.txt") lines flagged (see $OUTD/readcheck.txt)"
[ "${STILLS:-0}" = 1 ] && sh "$HERE/tools-stills.sh" "$NAME"
echo "done in $(( $(date +%s) - T0 )) s: $HERE/out/viza-$NAME-$SLUG.mp4"

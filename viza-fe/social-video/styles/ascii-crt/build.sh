#!/bin/sh
# VIZA shorts in the ascii-crt style. From the social-video folder:
#   sh styles/ascii-crt/build.sh specs/<name>.json            → styles/ascii-crt/out/viza-<name>-ascii-crt.mp4 (+ .srt)
#   STILLS=1 sh styles/ascii-crt/build.sh specs/<name>.json   → review stills + contact sheet in out/<name>/stills/
# Env: LIB (lemo-opuscar library, default ~/lemo-opuscar), WORKERS (default 2; Robert has 8 GB).
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
SV=$(cd "$HERE/../.." && pwd)
LIB=${LIB:-$HOME/lemo-opuscar}; export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the lemo-opuscar library folder" >&2; exit 1; }
SPEC=$1; [ -n "$SPEC" ] || { echo "usage: sh styles/ascii-crt/build.sh specs/<name>.json" >&2; exit 2; }
[ -f "$SPEC" ] || SPEC="$SV/$SPEC"; [ -f "$SPEC" ] || { echo "spec not found: $1" >&2; exit 1; }
SPEC=$(cd "$(dirname "$SPEC")" && pwd)/$(basename "$SPEC")
NAME=$(basename "$SPEC" .json); SLUG=ascii-crt
PY="$LIB/.venv/bin/python"; SIZE=1080x1920; FPS=24
O="$HERE/out/$NAME"; mkdir -p "$HERE/content" "$O"
sh "$HERE/tools/fonts.sh"
# content: the spec, its voice and the white logotype, served next to the page
cp "$SPEC" "$HERE/content/$NAME.json"
VOICE=$(node -e "process.stdout.write(require('$SPEC').voice||'')")
cp "$SV/public/$VOICE" "$HERE/content/$NAME.mp3"
cp "$SV/public/brand/viza-logotype-dark.svg" "$HERE/content/"
Q="spec=content/$NAME.json"
cd "$LIB"
if [ -n "$STILLS" ]; then
  TIMES=$(node -e "const s=require('$SPEC');const t=[];for(const c of s.scenes){const d=c.end-c.start;t.push(c.start+d*.45,c.end-.12)}console.log(t.map(x=>x.toFixed(2)).join(' '))")
  rm -rf "$O/stills"; node core/render/still.mjs "$HERE" $TIMES --q "$Q" --size $SIZE --out "$O/stills" >/dev/null
  "$PY" core/render/sheet.py "$O/stills/sheet.jpg" $(ls "$O"/stills/t_*.jpg | sort -t_ -k2 -n) --cols 4 --w 360
  exit 0
fi
T0=$(date +%s)
node core/render/events.mjs "$HERE" --q "$Q" --size $SIZE --out "$O/events.json"
node -e "const s=require('$SPEC');require('fs').writeFileSync('$O/subs.json',JSON.stringify((s.captions||[]).map(c=>({t0:c.start,t1:c.end,text:c.text}))))"
"$PY" core/render/srt.py "$O/subs.json" "$HERE/out/viza-$NAME-$SLUG.srt"
ffmpeg -v error -y -i "$HERE/content/$NAME.mp3" -ac 1 -ar 48000 "$O/voice.wav"
"$PY" "$HERE/mix.py" "$O/events.json" "$O/voice.wav" "$O/mix.wav"
node core/render/video.mjs "$HERE" --fps $FPS --workers ${WORKERS:-2} --q "$Q" --size $SIZE --out "$O/video.mp4"
sh core/render/mux.sh "$O/video.mp4" "$O/mix.wav" "$HERE/out/viza-$NAME-$SLUG.mp4" $FPS 0
echo "done in $(( $(date +%s) - T0 )) s → $HERE/out/viza-$NAME-$SLUG.mp4"

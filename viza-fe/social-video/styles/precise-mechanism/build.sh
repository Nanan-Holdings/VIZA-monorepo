#!/bin/sh
# VIZA short in the Color-Coded Mechanism style (precise-mechanism), from any VideoSpec.
#   sh styles/precise-mechanism/build.sh specs/<name>.json         → out/viza-<name>-precise-mechanism.mp4 (from the social-video folder)
#   PREP_ONLY=1 sh …/build.sh specs/<name>.json                     copy the spec, voice and logo into content/<name>/ and stop (for stills)
#   WORKERS=3 sh …/build.sh …                                       render workers (default 2, sized for an 8 GB Mac mini)
#   LIB=<lemo-opuscar library> sh …/build.sh …                      default ~/lemo-opuscar
# Stills: node $LIB/core/render/still.mjs styles/precise-mechanism 1 8 20 --size 1080x1920 --q spec=<name>
set -e
HERE=$(cd "$(dirname "$0")" && pwd)                 # …/social-video/styles/precise-mechanism
SV=$(cd "$HERE/../.." && pwd)                        # …/social-video
LIB=${LIB:-$HOME/lemo-opuscar}
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the lemo-opuscar library folder"; exit 1; }
SPEC="$1"; [ -n "$SPEC" ] || { echo "usage: sh styles/precise-mechanism/build.sh specs/<name>.json"; exit 2; }
case "$SPEC" in /*) ;; *) SPEC="$SV/$SPEC";; esac
[ -f "$SPEC" ] || { echo "spec not found: $SPEC"; exit 1; }
NAME=$(basename "$SPEC" .json)
SLUG=precise-mechanism
WK=${WORKERS:-2}
PY="$LIB/.venv/bin/python"
C="$HERE/content/$NAME"; O="$HERE/out/$NAME"
mkdir -p "$C" "$O" "$SV/out"

# fonts (SIL OFL 1.1, github.com/google/fonts), fetched once
F="$HERE/fonts"; G=https://github.com/google/fonts/raw/main/ofl; mkdir -p "$F"
[ -f "$F/Inter-VF.ttf" ] || curl -sfL -o "$F/Inter-VF.ttf" "$G/inter/Inter%5Bopsz,wght%5D.ttf"
[ -f "$F/NotoSansSC-VF.ttf" ] || curl -sfL -o "$F/NotoSansSC-VF.ttf" "$G/notosanssc/NotoSansSC%5Bwght%5D.ttf"
[ -f "$F/IBMPlexMono-Medium.ttf" ] || curl -sfL -o "$F/IBMPlexMono-Medium.ttf" "$G/ibmplexmono/IBMPlexMono-Medium.ttf"

# content: the spec, its voice (MP3 as given, already at −14 LUFS; a WAV copy for the mixer) and the VIZA logotype drawn for a light ground
cp "$SPEC" "$C/spec.json"
VOICE=$("$PY" -c "import json,sys; print(json.load(open(sys.argv[1]))['voice'])" "$SPEC")
cp "$SV/public/$VOICE" "$C/voice.mp3"
ffmpeg -y -loglevel error -i "$C/voice.mp3" -ac 1 -ar 48000 "$C/voice.wav"
cp "$SV/public/brand/viza-logotype-light.svg" "$C/logo.svg"      # black logotype, as drawn (never recoloured)
printf '{"name":"%s"}\n' "$NAME" > "$HERE/content/current.json"
[ -n "$PREP_ONLY" ] && { echo "prepared $C"; exit 0; }

cd "$LIB"
"$PY" core/audio/sampler.py --need "$HERE/mix.py" >/dev/null 2>&1 || true     # sample libraries before the long picture render
T0=$(date +%s)
node core/render/events.mjs "$HERE" --size 1080x1920 --q "spec=$NAME" --out "$C/events.json"
node core/render/video.mjs "$HERE" --size 1080x1920 --fps 24 --workers "$WK" --q "spec=$NAME" --out "$O/video.mp4"
T1=$(date +%s)
"$PY" "$HERE/mix.py" "$C" "$O/mix.wav"
sh core/render/mux.sh "$O/video.mp4" "$O/mix.wav" "$SV/out/viza-$NAME-$SLUG.mp4" 24 0
node core/render/still.mjs "$HERE" "$(awk 'BEGIN{print 0}')" --size 1080x1920 --q "spec=$NAME" --prefix poster_ --out "$O" >/dev/null 2>&1 || true
node core/render/readcheck.mjs "$HERE" --size 1080x1920 --q "spec=$NAME" > "$O/readcheck.txt" 2>&1 && echo "readcheck ok" || echo "readcheck: see $O/readcheck.txt"
echo "picture $((T1 - T0)) s"
echo "done: $SV/out/viza-$NAME-$SLUG.mp4"

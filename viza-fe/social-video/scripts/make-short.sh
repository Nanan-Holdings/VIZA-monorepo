#!/bin/zsh
# One topic from pipeline/topics.json to finished MP4s: draft (DeepSeek, validated) -> Kokoro voice
# -> spec -> Remotion render. Prints the MP4 paths on the last lines.
#   scripts/make-short.sh <topic-id> [--keep-script]
# STYLE=<slug> renders with styles/<slug>/build.sh (Lemo Opuscar looks) instead of the Remotion scenes;
# the MP4 is then out/viza-<topic>-<lang>-<slug>.mp4.
# --keep-script reuses scripts/scripts-in/<id>-<lang>.json if it exists (after a human edit).
set -euo pipefail
cd "${0:A:h}/.."
id="$1"; keep="${2:-}"
PY="${KOKORO_PYTHON:-$HOME/.venvs/kokoro/bin/python3}"
langs=$(node -e "const t=require('./pipeline/topics.json').topics.find(x=>x.id==='$id'); if(!t){process.exit(2)}; console.log(t.langs.join(' '))")
need_draft=0
for l in ${=langs}; do [[ -f "scripts/scripts-in/$id-$l.json" ]] || need_draft=1; done
if [[ "$keep" != "--keep-script" || $need_draft == 1 ]]; then
  npx tsx scripts/draft-topic.ts --topic "$id"
fi
for l in ${=langs}; do
  "$PY" scripts/tts_local.py "scripts/scripts-in/$id-$l.json" 2>&1 | grep -E "^(voiced|whisper|downloading)" || true
  npx tsx scripts/build-spec.ts "scripts/scripts-in/$id-$l.json"
  if [[ -n "${STYLE:-}" && "$STYLE" != remotion ]]; then
    sh "styles/$STYLE/build.sh" "specs/$id-$l.json"
    # Some style builds write into their own out/; collect the film where daily.py looks for it.
    if [[ -f "styles/$STYLE/out/viza-$id-$l-$STYLE.mp4" ]]; then
      mkdir -p out && cp "styles/$STYLE/out/viza-$id-$l-$STYLE.mp4" "out/viza-$id-$l-$STYLE.mp4"
    fi
    [[ -f "out/viza-$id-$l-$STYLE.mp4" ]] || { echo "style build made no MP4"; exit 1; }
    echo "MP4 out/viza-$id-$l-$STYLE.mp4"
  else
    npx tsx scripts/render.ts "specs/$id-$l.json" 2>&1 | grep -v "network requests to load fonts"
    echo "MP4 out/viza-$id-$l.mp4"
  fi
done

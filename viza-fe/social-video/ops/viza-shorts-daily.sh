#!/bin/zsh
# VIZA daily short, launchd on Robert (com.viza.shorts). Same pattern as GrooveSheet's
# ops/shorts-daily.sh: its own checkout, reap zombie Chrome first, log to runs/, keep a week of renders.
set -euo pipefail
VIDEO="${VIZA_SHORTS_DIR:-$HOME/Github/Nanan-Holdings/VIZA-shorts/viza-fe/social-video}"
cd "$VIDEO/pipeline"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export KOKORO_PYTHON="$HOME/.venvs/kokoro/bin/python3"
GS_MAIN="$HOME/Github/GrooveSheet/groovesheet-social"
[[ -x "$GS_MAIN/ops/reap-chrome-zombies.sh" ]] && "$GS_MAIN/ops/reap-chrome-zombies.sh" || true
mkdir -p runs
LOG="runs/launchd.log"
echo "===== viza shorts $(date '+%Y-%m-%d %H:%M:%S %Z') =====" >> "$LOG"
# Python: the venv with requests + google-api-python-client (GrooveSheet's production venv has both).
PY="${VIZA_SHORTS_PYTHON:-$GS_MAIN/.venv/bin/python}"
nice -n 10 "$PY" daily.py "$@" >> "$LOG" 2>&1 || echo "viza shorts exited $?" >> "$LOG"
# Views at 48 h per post, for the style test and for Ivy (the VIZA OpenClaw agent) to read.
"$PY" metrics.py >> "$LOG" 2>&1 || echo "metrics exited $?" >> "$LOG"
find "$VIDEO/out" -name 'viza-*.mp4' -mtime +7 -delete 2>/dev/null || true

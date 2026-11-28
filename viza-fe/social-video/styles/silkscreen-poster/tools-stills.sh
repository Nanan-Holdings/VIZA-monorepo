#!/bin/sh
# review stills: sh tools-stills.sh <spec name>  → stills/<name>/sheet.jpg (three frames per scene)
set -e
HERE=$(cd "$(dirname "$0")" && pwd); LIB=${LIB:-$HOME/lemo-opuscar}; N=$1
TS=$(python3 -c "
import json; s=json.load(open('$HERE/content/$N.json'))
out=[]
for sc in s['scenes']:
  a,b=sc['start'],sc['end']; out += [a+0.5, (a+b)/2, b-0.3]
print(' '.join('%.2f'%t for t in out))")
rm -rf "$HERE/stills/$N"; cd "$LIB"
node core/render/still.mjs "$HERE" $TS --q "spec=$N" --size 1080x1920 --out "$HERE/stills/$N" > /dev/null
"$LIB/.venv/bin/python" core/render/sheet.py "$HERE/stills/$N/sheet.jpg" $(for t in $TS; do echo "$HERE/stills/$N/t_$t.jpg"; done) --cols 6 --w 330

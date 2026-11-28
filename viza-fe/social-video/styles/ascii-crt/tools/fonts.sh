#!/bin/sh
# Fonts for the ascii-crt template (SIL Open Font License 1.1): VT323 for the grid, Noto Sans SC for full-width CJK cells.
# Fetched once into ../fonts/ (not kept in git). FORCE=1 fetches again.
set -e
D=$(cd "$(dirname "$0")/.." && pwd)/fonts; mkdir -p "$D"
GF=https://raw.githubusercontent.com/google/fonts/86aced91de05cd4f96a06838124cca45be337b2b
get() {
  [ -s "$D/$1" ] && [ -z "$FORCE" ] && return 0
  curl -fsSL -g --retry 2 -o "$D/download.part" "$2" || { rm -f "$D/download.part"; echo "could not fetch fonts/$1 from $2" >&2; exit 1; }
  mv "$D/download.part" "$D/$1"; echo "fonts/$1"
}
get VT323-Regular.ttf "$GF/ofl/vt323/VT323-Regular.ttf"
get OFL-VT323.txt "$GF/ofl/vt323/OFL.txt"
get NotoSansSC.ttf "$GF/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf"
get OFL-NotoSansSC.txt "$GF/ofl/notosanssc/OFL.txt"

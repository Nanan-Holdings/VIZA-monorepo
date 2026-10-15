#!/usr/bin/env bash
# Normalise a voice or music file to a broadcast-style loudness target so every short mixes the same.
#   scripts/normalize-audio.sh public/voice/etias-en.mp3 [-14]
set -euo pipefail
in="$1"; target="${2:--14}"
tmp="$(mktemp -t vizaaudio).mp3"
ffmpeg -nostdin -loglevel error -y -i "$in" -af "loudnorm=I=${target}:TP=-1.5:LRA=7" -ar 48000 -b:a 192k "$tmp"
mv "$tmp" "$in"
echo "normalised $in to ${target} LUFS"

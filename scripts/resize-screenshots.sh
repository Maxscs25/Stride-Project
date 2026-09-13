#!/usr/bin/env bash
# Scale App Store screenshots to the 1290 x 2796 set used by the live listing.
#
# The simulators available locally (iPhone 16/17 Pro Max) render 1320 x 2868.
# That is also a valid 6.9" size, but a set has to be internally consistent and
# ours is already 1290 x 2796 — so scale proportionally to 1290 wide, then trim
# the ~7px of surplus height rather than squashing to fit.
#
# Usage:  scripts/resize-screenshots.sh [files...]   (defaults to store-assets/screenshots/*.png)
set -euo pipefail

W=1290
H=2796

files=("$@")
if [ ${#files[@]} -eq 0 ]; then
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  shopt -s nullglob
  files=("$root"/store-assets/screenshots/*.png)
fi

for f in "${files[@]}"; do
  cur=$(sips -g pixelWidth -g pixelHeight "$f" | awk '/pixelWidth|pixelHeight/ {print $2}' | paste -sd'x' -)
  if [ "$cur" = "${W}x${H}" ]; then
    echo "skip  $(basename "$f")  (already ${W}x${H})"
    continue
  fi
  sips --resampleWidth "$W" "$f" >/dev/null
  sips --cropToHeightWidth "$H" "$W" "$f" >/dev/null
  echo "ok    $(basename "$f")  ${cur} -> ${W}x${H}"
done

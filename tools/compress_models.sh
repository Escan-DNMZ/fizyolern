#!/usr/bin/env bash
# Vereinfacht und komprimiert die Roh-GLBs aus build_bp3d.py für das Handy.
# Aufruf: tools/compress_models.sh <ordner-mit-*_raw.glb> <gltf-transform-binary>
set -euo pipefail
IN="$1"; GT="$2"; OUT="$(dirname "$0")/../models"
for name in bones muscles; do
  "$GT" weld "$IN/${name}_raw.glb" "$IN/${name}_w.glb"
  "$GT" simplify "$IN/${name}_w.glb" "$IN/${name}_s.glb" --ratio "${RATIO:-0.3}" --error 0.0004
  "$GT" draco "$IN/${name}_s.glb" "$OUT/${name}.glb" --method edgebreaker
  ls -l "$OUT/${name}.glb"
done

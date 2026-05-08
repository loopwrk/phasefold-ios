#!/usr/bin/env bash
# Build the Phasefold DSP crate to Wasm.
#
# Prerequisites:
#   rustup target add wasm32-unknown-unknown
#   cargo install wasm-pack
#
# Output lands in crate/pkg/ as an ES module ready for Vite.

set -euo pipefail
cd "$(dirname "$0")"

wasm-pack build \
  --target web \
  --out-dir pkg \
  --release \
  --no-typescript

echo "Build complete - output in crate/pkg/"

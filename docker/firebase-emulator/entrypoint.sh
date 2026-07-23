#!/bin/sh
set -eu

PROJECT_ID="${FIREBASE_PROJECT_ID:-demo-tufffinds}"

firebase emulators:start \
  --only auth,firestore,storage \
  --project "$PROJECT_ID" &
EMULATOR_PID=$!

cleanup() {
  kill "$EMULATOR_PID" 2>/dev/null || true
  wait "$EMULATOR_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

node ./docker/firebase-emulator/seed.mjs

wait "$EMULATOR_PID"

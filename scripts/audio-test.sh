#!/usr/bin/env bash
# Real audio through the audio path: macOS Hindi TTS -> webm/opus -> POST /api/understand.
# Usage: scripts/audio-test.sh   (needs the local server running; BASE_URL optional)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=tmp/audio
mkdir -p "$OUT"
SENTENCE="${1:-दो किलो आटा और एक अमूल दूध, शर्मा जी के खाते में लिख दो}"
VOICE="${VOICE:-Lekha}"
say -v "$VOICE" -o "$OUT/utterance.aiff" "$SENTENCE"
ffmpeg -loglevel error -y -i "$OUT/utterance.aiff" -ac 1 -ar 48000 -c:a libopus -b:a 32k "$OUT/utterance.webm"
ls -l "$OUT/utterance.webm" | awk '{print "audio bytes:", $5}'
node scripts/audio-test.ts "$OUT/utterance.webm" audio/webm

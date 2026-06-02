#!/usr/bin/env bash
# =============================================================================
# scripts/demo/record-usage.sh
# -----------------------------------------------------------------------------
# Portable fallback for the VHS tape (usage.tape) when vhs/ttyd/ffmpeg are not
# installed. Runs the SAME command sequence as usage.tape against the REAL
# create-ack CLI, in a throwaway temp dir (never scaffolds into the kit), with
# simulated "typing" + pauses so it reads well when captured by asciinema.
#
# Capture to a .cast (asciinema):
#   asciinema rec --overwrite \
#     --command "bash /Users/arthur/dev/stallae/ai-core-kit/scripts/demo/record-usage.sh" \
#     /Users/arthur/dev/stallae/ai-core-kit/docs/demo/ack-usage.cast
#
# Convert the .cast to an animated SVG (svg-term-cli):
#   npx svg-term-cli \
#     --in  /Users/arthur/dev/stallae/ai-core-kit/docs/demo/ack-usage.cast \
#     --out /Users/arthur/dev/stallae/ai-core-kit/docs/demo/ack-usage.svg \
#     --window --width 110 --height 30
#
# Or just watch it run (no recorder needed):
#   bash /Users/arthur/dev/stallae/ai-core-kit/scripts/demo/record-usage.sh
#
# No `npm install` runs here — create-ack is LLM-free and finishes in ~200ms.
# =============================================================================
set -euo pipefail

# Resolve the kit root from this script's location so the demo is path-portable.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CREATE_ACK="$KIT_ROOT/bin/create-ack.mjs"

if [[ ! -f "$CREATE_ACK" ]]; then
  echo "record-usage: cannot find create-ack at $CREATE_ACK" >&2
  exit 1
fi

# --- pacing knobs (override via env) -----------------------------------------
TYPE_DELAY="${TYPE_DELAY:-0.045}"  # per-character "typing" delay
PROMPT="$(printf '\033[36m$\033[0m ')"

# Print a command character-by-character (simulated typing), then a newline.
type_cmd() {
  local line="$1"
  printf '%s' "$PROMPT"
  local i ch
  for (( i = 0; i < ${#line}; i++ )); do
    ch="${line:i:1}"
    printf '%s' "$ch"
    sleep "$TYPE_DELAY"
  done
  printf '\n'
}

# Type a command, pause, then actually run it.
run_cmd() {
  type_cmd "$1"
  sleep 0.4
  eval "$1"
}

# --- run the demo in a throwaway temp dir ------------------------------------
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

clear 2>/dev/null || true

# 1. scaffold a NEW child project with the real CLI (LLM-free, ~200ms)
run_cmd "node $CREATE_ACK acme-app --archetype fullstack --yes"
sleep 2.5

# 2. step into the generated project
run_cmd "cd acme-app"
sleep 0.5

# 3. what got generated (note: lots of CONTEXT, little code)
run_cmd "ls"
sleep 2.0

# 4. CLAUDE.md — the lean spec-first entry point Claude reads every turn
run_cmd "sed -n '1,20p' CLAUDE.md"
sleep 3.5

# 5. specs/ — the ground-truth narrative the project is built from
run_cmd "ls specs/"
sleep 2.5

# 6. docs/ — a ready-to-run product documentation site
run_cmd "ls docs/"
sleep 2.5

# 7. the headline next step
run_cmd "echo 'Next: open in Claude Code and run /ack-spec to generate the full specs'"
sleep 3.0

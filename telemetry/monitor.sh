#!/usr/bin/env bash
# telemetry/monitor.sh — LOCAL AI-cost / budget monitor (ai-core-kit, META layer)
#
# WHY THIS IS LOCAL (and not in CI):
#   Token cost is derived offline from the Claude Code transcripts under
#   ~/.claude/projects/**/*.jsonl. Those transcripts exist ONLY on the machine
#   that ran the sessions — a GitHub runner has none of them. So cost/budget
#   alerting CANNOT live in CI; it must run where the data is: your machine.
#   (DORA, by contrast, reads git history and DOES run in CI — see
#   .github/workflows/monitor.yml.)
#
# WHAT IT DOES:
#   Runs the offline aggregator with a strict advisory budget cap. If total spend
#   exceeds the cap, aggregate.py exits non-zero; this script then prints a clear
#   ALERT, fires a desktop notification when one is available, and exits non-zero
#   so a scheduler (cron/launchd) can surface the failure.
#
# USAGE:
#   telemetry/monitor.sh [BUDGET_USD] [-- extra aggregate.py flags...]
#
#   BUDGET_USD   advisory USD ceiling. Resolution order:
#                  1) first positional arg, 2) $ACK_BUDGET_USD env, 3) default 50.
#   Anything after a literal `--` is passed straight through to aggregate.py,
#   e.g. to scope a window or attribution:
#     telemetry/monitor.sh 25 -- --since 2026-06-01 --by feature --branch-prefix feat/
#
# ENV:
#   ACK_BUDGET_USD     budget cap (overridden by a positional arg).
#   ACK_PROJECT_DIR    transcript glob root (default: ~/.claude/projects).
#   ACK_PYTHON         python interpreter (default: python3).
#
# EXIT CODES:
#   0  under budget (healthy)
#   1  OVER budget  (alert fired)
#   2  usage / environment error (e.g. aggregator missing)
#
# ─────────────────────────────────────────────────────────────────────────────
# SCHEDULING (cost data is machine-local, so schedule it on YOUR machine):
#
#   cron (Linux / macOS) — daily at 09:00, log to a file:
#     crontab -e
#     0 9 * * *  /ABS/PATH/TO/telemetry/monitor.sh 50 >> "$HOME/.cache/ack-monitor.log" 2>&1
#
#   macOS launchd — create ~/Library/LaunchAgents/dev.ack.costmonitor.plist:
#     <?xml version="1.0" encoding="UTF-8"?>
#     <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
#       "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
#     <plist version="1.0"><dict>
#       <key>Label</key><string>dev.ack.costmonitor</string>
#       <key>ProgramArguments</key>
#       <array>
#         <string>/ABS/PATH/TO/telemetry/monitor.sh</string>
#         <string>50</string>
#       </array>
#       <key>StartCalendarInterval</key><dict><key>Hour</key><integer>9</integer>
#         <key>Minute</key><integer>0</integer></dict>
#       <key>StandardOutPath</key><string>/tmp/ack-monitor.out.log</string>
#       <key>StandardErrorPath</key><string>/tmp/ack-monitor.err.log</string>
#     </dict></plist>
#   then load it:
#     launchctl load ~/Library/LaunchAgents/dev.ack.costmonitor.plist
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Resolve repo paths relative to THIS script (works regardless of CWD).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGGREGATE="${SCRIPT_DIR}/aggregate.py"
PYTHON="${ACK_PYTHON:-python3}"

# ── Parse args: optional BUDGET, then passthrough after `--`. ────────────────
BUDGET=""
PASSTHRU=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --) shift; PASSTHRU=("$@"); break ;;
    -h|--help) sed -n '2,60p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *)
      if [ -z "$BUDGET" ]; then BUDGET="$1"; else PASSTHRU+=("$1"); fi
      shift ;;
  esac
done
BUDGET="${BUDGET:-${ACK_BUDGET_USD:-50}}"
PROJECT_DIR="${ACK_PROJECT_DIR:-$HOME/.claude/projects}"

# ── Desktop notification (best-effort; never fatal). ─────────────────────────
notify() {
  local title="$1" msg="$2"
  if command -v osascript >/dev/null 2>&1; then            # macOS
    osascript -e "display notification \"${msg//\"/\\\"}\" with title \"${title//\"/\\\"}\"" >/dev/null 2>&1 || true
  elif command -v notify-send >/dev/null 2>&1; then         # Linux (libnotify)
    notify-send "$title" "$msg" >/dev/null 2>&1 || true
  fi
}

# ── Preconditions. ───────────────────────────────────────────────────────────
if [ ! -f "$AGGREGATE" ]; then
  echo "ERROR: aggregator not found at $AGGREGATE" >&2
  exit 2
fi
if ! command -v "$PYTHON" >/dev/null 2>&1; then
  echo "ERROR: python interpreter '$PYTHON' not found (set ACK_PYTHON)." >&2
  exit 2
fi

echo "ai-core-kit cost monitor — cap \$${BUDGET} USD over ${PROJECT_DIR}"

# ── Run the strict-budget aggregation. Capture output AND exit code. ─────────
# aggregate.py exits non-zero when --budget-strict and spend > cap. We must not
# let `set -e` abort here, so guard the call.
set +e
OUTPUT="$("$PYTHON" "$AGGREGATE" \
  --project-dir "$PROJECT_DIR" \
  --budget "$BUDGET" \
  --budget-strict \
  --format table \
  ${PASSTHRU[@]+"${PASSTHRU[@]}"} 2>&1)"
STATUS=$?
set -e

echo "$OUTPUT"

if [ "$STATUS" -ne 0 ]; then
  # Pull the budget line for a concise alert message (falls back to generic text).
  SUMMARY="$(printf '%s\n' "$OUTPUT" | grep -E 'spent \$' | head -1 || true)"
  [ -z "$SUMMARY" ] && SUMMARY="spend exceeded the \$${BUDGET} cap"
  echo ""
  echo "================  ALERT: AI SPEND OVER BUDGET  ================"
  echo "  cap   : \$${BUDGET} USD"
  echo "  detail: ${SUMMARY}"
  echo "=============================================================="
  notify "ai-core-kit: AI spend over budget" "${SUMMARY}"
  exit 1
fi

echo "OK: under the \$${BUDGET} budget."
exit 0

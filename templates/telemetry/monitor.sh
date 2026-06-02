#!/usr/bin/env bash
# telemetry/monitor.sh — LOCAL AI-cost / budget monitor for this project.
#
# Installed by ai-core-kit's /ack-init when telemetry is enabled. See
# telemetry/MONITORING.md for the full tiered story and scheduling recipes.
#
# WHY THIS IS LOCAL (and not in CI):
#   Token cost is derived offline from the Claude Code transcripts under
#   ~/.claude/projects/**/*.jsonl. Those transcripts exist ONLY on the machine
#   that ran the sessions — a CI runner has none of them. So cost/budget alerting
#   CANNOT live in CI; it runs where the data is: your machine. (DORA reads git
#   history and DOES run in CI — see telemetry/MONITORING.md for the GH-Action.)
#
# WHAT IT DOES:
#   Runs the offline aggregator with a strict advisory budget cap. The aggregator
#   resolves this project's pricing.json + project.manifest.yaml under
#   ${CLAUDE_PROJECT_DIR} automatically. If total spend exceeds the cap,
#   aggregate.py exits non-zero; this script prints a clear ALERT, fires a desktop
#   notification when available, and exits non-zero for a scheduler to catch.
#
# USAGE:
#   telemetry/monitor.sh [BUDGET_USD] [-- extra aggregate.py flags...]
#
#   BUDGET_USD   advisory USD ceiling. Resolution order:
#                  1) first positional arg, 2) $ACK_BUDGET_USD env, 3) default 50.
#   Anything after a literal `--` is passed straight through to aggregate.py:
#     telemetry/monitor.sh 25 -- --since 2026-01-01 --by feature
#
# ENV:
#   ACK_BUDGET_USD     budget cap (overridden by a positional arg).
#   ACK_PROJECT_DIR    transcript glob root (default: ~/.claude/projects).
#   ACK_PYTHON         python interpreter (default: python3).
#   CLAUDE_PROJECT_DIR set by Claude Code; lets aggregate.py find this project's
#                      manifest + pricing.json. When run outside a hook, this
#                      script falls back to its own location.
#
# EXIT CODES:
#   0  under budget (healthy)
#   1  OVER budget  (alert fired)
#   2  usage / environment error (e.g. aggregator missing)
#
# SCHEDULING: cost data is machine-local — schedule it on YOUR machine.
#   See telemetry/MONITORING.md for cron and macOS launchd recipes.
set -euo pipefail

# Resolve paths relative to THIS script so it works regardless of CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGGREGATE="${SCRIPT_DIR}/aggregate.py"
PYTHON="${ACK_PYTHON:-python3}"

# Help aggregate.py find the project manifest + pricing.json even when this
# script is run by hand outside a Claude Code hook.
export CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"

# ── Parse args: optional BUDGET, then passthrough after `--`. ────────────────
BUDGET=""
PASSTHRU=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --) shift; PASSTHRU=("$@"); break ;;
    -h|--help) sed -n '2,48p' "${BASH_SOURCE[0]}"; exit 0 ;;
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

echo "cost monitor — cap \$${BUDGET} USD over ${PROJECT_DIR}"

# ── Run the strict-budget aggregation. Capture output AND exit code. ─────────
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
  SUMMARY="$(printf '%s\n' "$OUTPUT" | grep -E 'spent \$' | head -1 || true)"
  [ -z "$SUMMARY" ] && SUMMARY="spend exceeded the \$${BUDGET} cap"
  echo ""
  echo "================  ALERT: AI SPEND OVER BUDGET  ================"
  echo "  cap   : \$${BUDGET} USD"
  echo "  detail: ${SUMMARY}"
  echo "=============================================================="
  notify "AI spend over budget" "${SUMMARY}"
  exit 1
fi

echo "OK: under the \$${BUDGET} budget."
exit 0

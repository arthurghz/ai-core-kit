# Telemetry monitoring — scheduled DORA + local cost alerts

This project ships a **tiered** monitoring model. The split below is not
arbitrary — it follows where each kind of data actually lives:

| Tier | What | Infra | Where it runs |
|---|---|---|---|
| **0** (default) | CLI + a self-contained report | none | your machine, on demand |
| **1** (this doc) | scheduled monitor: DORA in CI + cost locally | zero NEW infra | split (see below) |
| **2** (opt-in) | Prometheus + Grafana dashboards | Docker | `telemetry/observability/` |

> **The local-vs-CI split (read this first).**
> **DORA** is computed from **git history**, which a CI runner has — so DORA
> monitoring runs as a **GitHub Action** on a schedule.
> **AI token cost** is computed from Claude Code transcripts under
> `~/.claude/projects/**/*.jsonl`. Those exist **only on the developer's
> machine** — a CI runner has none of them. So cost/budget monitoring runs
> **locally** via `telemetry/monitor.sh`, scheduled with cron or launchd.
> Putting cost in CI would silently report `$0.00` for every run.

---

## A. Local cost monitor — `telemetry/monitor.sh`

Runs the offline aggregator with a strict advisory budget cap. The aggregator
resolves this project's `pricing.json` and `project.manifest.yaml` (for
attribution + `telemetry.budgets[]`) under `${CLAUDE_PROJECT_DIR}`
automatically. On overage it prints a clear ALERT, fires a desktop notification
(macOS `osascript`, else Linux `notify-send`), and exits non-zero.

```bash
# default $50 cap over all local transcripts:
telemetry/monitor.sh

# explicit cap, scoped to this project's feature branches since a date:
telemetry/monitor.sh 25 -- --since 2026-01-01 --by feature
```

Resolution order for the cap: positional arg → `$ACK_BUDGET_USD` → default `50`.
Exit codes: `0` healthy, `1` over budget, `2` usage/environment error.

### Schedule it (cost data is machine-local)

**cron (Linux / macOS)** — daily at 09:00, appending to a log:

```cron
0 9 * * *  /ABS/PATH/TO/telemetry/monitor.sh 50 >> "$HOME/.cache/ack-monitor.log" 2>&1
```

**macOS launchd** — `~/Library/LaunchAgents/dev.ack.costmonitor.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>dev.ack.costmonitor</string>
  <key>ProgramArguments</key>
  <array>
    <string>/ABS/PATH/TO/telemetry/monitor.sh</string>
    <string>50</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/tmp/ack-monitor.out.log</string>
  <key>StandardErrorPath</key><string>/tmp/ack-monitor.err.log</string>
</dict></plist>
```

```bash
launchctl load ~/Library/LaunchAgents/dev.ack.costmonitor.plist
```

---

## B. Scheduled DORA monitor — GitHub Action

DORA reads `git log`/tags, which the runner has when you check out **full
history** (`fetch-depth: 0`). The action writes the human report to the job
summary and, when change-failure-rate exceeds a threshold (or a deploy is
overdue, or a failure is unresolved), **opens or refreshes** a labelled issue;
it **closes** that issue when metrics recover.

Create `.github/workflows/monitor.yml` in this fork:

```yaml
name: Telemetry monitor (DORA)

on:
  schedule:
    - cron: '0 8 * * 1'      # weekly, Monday 08:00 UTC
  workflow_dispatch:
    inputs:
      cfr_threshold_pct:
        description: 'Change-failure-rate alert threshold (percent).'
        type: string
        default: '15'
      window:
        description: 'DORA window: 30d | 12w | 6m | 1y | YYYY-MM-DD'
        type: string
        default: '30d'
      deploy_mode:
        description: 'What counts as a deploy: tag | merge.'
        type: choice
        options: [tag, merge]
        default: tag

permissions:
  contents: read
  issues: write

concurrency:
  group: telemetry-monitor
  cancel-in-progress: false

jobs:
  dora:
    runs-on: ubuntu-latest
    env:
      CFR_THRESHOLD_PCT: ${{ github.event.inputs.cfr_threshold_pct || '15' }}
      WINDOW: ${{ github.event.inputs.window || '30d' }}
      DEPLOY_MODE: ${{ github.event.inputs.deploy_mode || 'tag' }}
      GH_TOKEN: ${{ github.token }}
      ISSUE_LABEL: metrics
    steps:
      - name: Checkout (FULL history — DORA reads git log/tags)
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: DORA report -> job summary
        run: |
          {
            echo '## DORA report (OFFLINE, from git history)'
            echo
            echo '```text'
            python3 telemetry/dora.py --window "${WINDOW}" --deploy-mode "${DEPLOY_MODE}" --format text
            echo '```'
            echo
            echo '> Token-COST monitoring is NOT in CI: ~/.claude transcripts do not'
            echo '> exist in a runner. Run telemetry/monitor.sh locally for cost.'
          } >> "$GITHUB_STEP_SUMMARY"

      - name: Compute DORA (JSON) and decide alert
        id: dora
        run: |
          set -euo pipefail
          python3 telemetry/dora.py --window "${WINDOW}" --deploy-mode "${DEPLOY_MODE}" --format json > dora.json
          python3 - "$CFR_THRESHOLD_PCT" <<'PY' >> "$GITHUB_OUTPUT"
          import json, sys
          threshold = float(sys.argv[1])
          d = json.load(open("dora.json"))
          cfr_pct = round((d["change_failure_rate"]["rate"] or 0.0) * 100, 1)
          deploys = d["deployment_frequency"]["deploys"]
          unresolved = d["mean_time_to_restore"]["unresolved_failures"]
          reasons = []
          if cfr_pct > threshold:
              reasons.append(f"Change-failure rate {cfr_pct}% exceeds threshold {threshold}%.")
          if deploys == 0:
              reasons.append("No deploys detected in the window (cadence overdue).")
          if unresolved > 0:
              reasons.append(f"{unresolved} unresolved failure(s).")
          alert = "true" if reasons else "false"
          print(f"alert={alert}")
          print("body<<BODY_EOF")
          print("Automated DORA monitor flagged a regression:\n")
          for r in reasons:
              print(f"- {r}")
          print("\nSee `telemetry/dora.py --help` for definitions and limits.")
          print("BODY_EOF")
          PY

      - name: Open or refresh the metrics issue
        if: steps.dora.outputs.alert == 'true'
        env:
          ISSUE_TITLE: 'DORA monitor: metrics regression'
          BODY: ${{ steps.dora.outputs.body }}
        run: |
          set -euo pipefail
          existing="$(gh issue list --state open --label "$ISSUE_LABEL" \
            --search "$ISSUE_TITLE in:title" --json number --jq '.[0].number // empty')"
          if [ -n "$existing" ]; then
            printf '%s\n' "$BODY" | gh issue comment "$existing" --body-file -
          else
            gh label create "$ISSUE_LABEL" --color FBCA04 --description "Telemetry / DORA monitor" 2>/dev/null || true
            printf '%s\n' "$BODY" | gh issue create --title "$ISSUE_TITLE" --label "$ISSUE_LABEL" --body-file -
          fi

      - name: Close the metrics issue (recovered)
        if: steps.dora.outputs.alert == 'false'
        env:
          ISSUE_TITLE: 'DORA monitor: metrics regression'
        run: |
          set -euo pipefail
          existing="$(gh issue list --state open --label "$ISSUE_LABEL" \
            --search "$ISSUE_TITLE in:title" --json number --jq '.[0].number // empty')"
          if [ -n "$existing" ]; then
            gh issue close "$existing" --comment "DORA metrics recovered. Auto-closed by the telemetry monitor."
          fi
```

### Notes & limits

- **`--format md` does not exist** — `dora.py` emits `text | json | prom`. The
  action fences the `text` report into the job summary and parses `json` for the
  alert decision; no jq is required (a stdlib `python3` snippet reads the JSON).
- DORA deploys/failures are **git proxies**, not a real deployment stream. Pick
  `deploy_mode` (`tag` vs `merge`) to match how you ship; ratings are directional.
- The issue is **idempotent**: one open issue per regression, refreshed on each
  run, closed automatically when metrics recover.

---

## C. Tier 2 (opt-in): Grafana

For live dashboards instead of scheduled checks, see
`telemetry/observability/` (Prometheus exporter + Grafana). That tier adds
Docker infra and is off by default.

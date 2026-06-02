---
name: agent-eval
description: >
  Head-to-head, reproducible comparison of coding agents (Claude Code, Aider,
  Codex, and others) on this project's own tasks — measuring pass rate, cost,
  wall-clock time, and consistency across repeated runs so agent/model selection
  is data-backed instead of vibes. Use when comparing agents on your codebase,
  evaluating a tool or model before adopting it, or running a regression check
  after a model/tooling update. Trigger on "which coding agent is best for us",
  "benchmark these agents", or "did the new model regress". Do NOT use to run a
  single agent on a real task (just run it) or to estimate the spend of one
  completed Claude Code run (use cost-audit / cost-telemetry).
license: MIT
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Agent Eval

A reproducible harness for comparing coding agents head-to-head on tasks drawn
from *this* project. Every "which agent is best?" debate runs on vibes — this
systematizes it into pass rate, cost, time, and consistency.

## When to activate

- Comparing coding agents (Claude Code, Aider, Codex, …) on your own codebase.
- Measuring agent performance before adopting a new tool or model.
- Running a regression check when an agent ships a model or tooling update.
- Producing a data-backed agent-selection decision for a team.

## When NOT to use

- Running a single agent to do real work — just run it.
- Estimating what one finished Claude Code run cost — use `cost-audit`.
- Writing the tasks under test — that is ordinary feature work.

## Core concepts

### Declarative task definitions

Define each task as data: what to do, which files it may touch, the base commit,
and how success is judged. Pin the commit so a result is reproducible weeks later.

```yaml
name: add-retry-logic
description: Add exponential backoff retry to the HTTP client
repo: ./my-project
commit: abc1234            # pin for reproducibility
files:
  - src/http_client.py
prompt: |
  Add retry logic with exponential backoff to all HTTP requests.
  Max 3 retries. Initial delay 1s, max delay 30s.
judge:
  - type: pytest
    command: pytest tests/test_http_client.py -v
  - type: grep
    pattern: "exponential_backoff|retry"
    files: src/http_client.py
```

### Isolation

Give each agent run its own git worktree from the pinned commit — no Docker
required. Worktrees keep runs from interfering with each other or corrupting the
base repo, and make a failed run trivially discardable.

### Metrics

| Metric | What it measures |
|---|---|
| Pass rate | Did the agent produce code that passes the judge? |
| Cost | Spend per task (when the agent reports it; otherwise use `cost-audit`) |
| Time | Wall-clock seconds to completion |
| Consistency | Pass rate across repeated runs (e.g. 3/3 = 100%) |

## Workflow

1. **Define 3–5 tasks** that represent real workload, in a `tasks/` directory —
   one YAML per task. Avoid toy examples; they predict nothing.
2. **Run each agent** against each task **at least 3 times** (agents are
   non-deterministic). For every run: create a fresh worktree from the pinned
   commit, hand the agent the prompt, run the judge, record pass/fail, cost, and time.
3. **Compare** the results in a table:

```text
Task: add-retry-logic (3 runs each)
┌─────────────┬───────────┬───────┬──────┬─────────────┐
│ Agent       │ Pass Rate │ Cost  │ Time │ Consistency │
├─────────────┼───────────┼───────┼──────┼─────────────┤
│ claude-code │ 3/3       │ $0.12 │ 45s  │ 100%        │
│ aider       │ 2/3       │ $0.08 │ 38s  │  67%        │
└─────────────┴───────────┴───────┴──────┴─────────────┘
```

## Judge types

**Deterministic (preferred)** — tests or a build command; an exact pass/fail.

```yaml
judge:
  - type: pytest
    command: pytest tests/ -v
  - type: command
    command: npm run build
```

**Pattern-based** — assert the change touched the right place.

```yaml
judge:
  - type: grep
    pattern: "class.*Retry"
    files: src/**/*.py
```

**Model-based (LLM-as-judge)** — for outcomes tests cannot capture. Use
sparingly; LLM judges add variance.

```yaml
judge:
  - type: llm
    prompt: |
      Does this implementation correctly handle exponential backoff?
      Check for: max retries, increasing delays, jitter.
```

## Best practices

- **Real tasks, not toys** — 3–5 tasks that mirror your actual workload.
- **≥ 3 trials per agent** — capture variance; a single run is noise.
- **Pin the commit** in every task so results are stable across days and weeks.
- **At least one deterministic judge per task** — tests/build anchor the score;
  LLM judges only fill gaps.
- **Track cost beside pass rate** — a 95% agent at 10× the cost may be the wrong
  choice. For Claude Code runs, attribute that cost with `cost-audit`.
- **Version task definitions as code** — they are test fixtures; review changes.

## Related skills

- `cost-audit` — attribute the spend of a Claude Code run that this eval triggered.
- `coding-standards` — the bar a "passing" implementation should also clear.

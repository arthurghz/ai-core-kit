# Demos (offline, local)

This directory holds two **fully offline / local** demo recorders. Neither one
talks to any remote/external service.

1. **Terminal "how to start & use" screencast** — `usage.tape` + `record-usage.sh`.
   Runs the **real** `create-ack` CLI in a throwaway temp dir and shows the
   spec-first payload it generates: `CLAUDE.md` + `specs/` + a product `docs/`
   site, with deliberately minimal code. **Start here** if you just want to show
   someone how to spin up an ai-core-kit project. See
   [Terminal usage screencast](#terminal-usage-screencast) below.
2. **Docs-site video walkthrough** — `record-demo.mjs`. A Playwright tour of the
   rendered documentation site. See
   [Docs-site walkthrough (Playwright)](#docs-site-walkthrough-playwright) below.

---

## Terminal usage screencast

Records the actual `create-ack` flow as a short (~30–50s), large-font, readable
terminal cast. It scaffolds a fresh `acme-app` (archetype `fullstack`) **in a
temp dir** — it never writes into the kit — and walks through what was generated:

```
acme-app/
├── CLAUDE.md             # lean, spec-first entry point Claude reads each turn
├── specs/                # PRD / ARCHITECTURE / DOMAIN / REQUIREMENTS / ROADMAP / NON-GOALS (+ adr/)
├── docs/                 # ready-to-run product documentation site
├── project.manifest.yaml # machine-owned project descriptor
└── …                     # minimal archetype scaffold (api/ app/ src/ …)
```

> No `npm install` runs in the demo — `create-ack` is LLM-free and finishes in
> ~200ms, so the recording stays short and the scaffold summary is the star.

### Source-of-truth command sequence

Both renderers run the **same** sequence (kept in sync between `usage.tape` and
`record-usage.sh`):

```bash
cd $(mktemp -d)
node <kit>/bin/create-ack.mjs acme-app --archetype fullstack --yes
cd acme-app
ls
sed -n '1,20p' CLAUDE.md
ls specs/
ls docs/
echo 'Next: open in Claude Code and run /ack-spec to generate the full specs'
```

### Way A — VHS (best quality: GIF + MP4)

[VHS](https://github.com/charmbracelet/vhs) renders the `.tape` straight to
video. Needs `vhs` plus its companions `ttyd` and `ffmpeg`:

```bash
brew install vhs ttyd ffmpeg
vhs scripts/demo/usage.tape
```

Outputs (paths are hard-coded in the tape):

```
docs/demo/ack-usage.gif
docs/demo/ack-usage.mp4
```

### Way B — asciinema + svg-term (no heavy deps)

When `vhs`/`ttyd`/`ffmpeg` are not available, capture the portable script with
[asciinema](https://asciinema.org) and convert to an animated SVG:

```bash
pip install asciinema                       # one-time

# record the real run into a .cast
asciinema rec --overwrite \
  --command "bash scripts/demo/record-usage.sh" \
  docs/demo/ack-usage.cast

# (optional) play it back in your terminal
asciinema play docs/demo/ack-usage.cast

# convert the .cast to an animated SVG (embeds nicely in Markdown/web)
npx --yes svg-term-cli \
  --in  docs/demo/ack-usage.cast \
  --out docs/demo/ack-usage.svg \
  --window --width 100 --height 30
```

Outputs:

```
docs/demo/ack-usage.cast   # asciinema recording (also uploadable to asciinema.org)
docs/demo/ack-usage.svg    # animated SVG, self-contained
```

You can also just **watch it run** with no recorder at all:

```bash
bash scripts/demo/record-usage.sh
```

Pacing knob: `TYPE_DELAY` (per-character typing delay, default `0.045`s) —
e.g. `TYPE_DELAY=0 bash scripts/demo/record-usage.sh` for an instant dry run.

### Rendered here?

This environment had **no** terminal renderer pre-installed (no `vhs`, `ttyd`,
`ffmpeg`, or `asciinema`). `asciinema` + `svg-term-cli` were installable, so the
checked-in `docs/demo/ack-usage.cast` and `docs/demo/ack-usage.svg` were rendered
via **Way B**. To produce the GIF/MP4 from the same tape, install VHS and run
**Way A** locally.

---

## Docs-site walkthrough (Playwright)

A self-contained [Playwright](https://playwright.dev) script that records a video
walkthrough of the ai-core-kit docs site. It is **fully offline / local** — it
drives a headless Chromium against a docs dev server **you** run locally and
depends on **no** external/remote service.

The final video is written to:

```
docs/demo/ack-how-it-works.webm
```

## What it captures

A ~30–40s motion tour, with gentle scrolling and pauses on each stop:

1. `/` — landing page
2. `/en/getting-started/quickstart` — quickstart guide
3. `/en/reference/skills` — skills reference
4. `/en/concepts/render-engine` — the render-engine page (shows the Mermaid diagram)
5. `/en/features/cost-telemetry` — cost telemetry feature
6. `/en/reference/observability` — observability reference
7. `/pt` — language-toggle shot (Portuguese home)

> Note: observability lives under `/en/reference/`, not `/en/features/`, so the
> script uses the real path.

## Prerequisites

- Node 18+ (ESM).
- A docs dev server running locally. By default the recorder targets
  `http://localhost:3099`.

## Run it

From this directory (`scripts/demo/`):

```bash
# 1) Start the docs server in another terminal, on the port the recorder targets.
#    From the repo's site/ directory:
cd ../../site && npx next dev -p 3099

# 2) First time only: install deps + the Chromium browser binary.
cd scripts/demo
npm i
npx playwright install chromium

# 3) Record.
npm run record
```

When it finishes it logs the final path and size, e.g.:

```
[record-demo] Done. Video written to: /…/ai-core-kit/docs/demo/ack-how-it-works.webm
[record-demo] Size: 1.84 MB (1932…  bytes)
```

## Configuration

Both knobs are environment variables:

| Var        | Default                        | Meaning                                   |
| ---------- | ------------------------------ | ----------------------------------------- |
| `BASE_URL` | `http://localhost:3099`        | Root URL of the running docs server.      |
| `OUT`      | `<repo>/docs/demo`             | Directory the final `.webm` is written to. |

Example — record against a docs server on port 3000 and drop the file elsewhere:

```bash
BASE_URL=http://localhost:3000 OUT=/tmp/out npm run record
```

## Notes

- **Nothing here is committed except the scripts (`usage.tape`, `record-usage.sh`,
  `record-demo.mjs`), this README, and `package.json`.** `node_modules/`, the
  Chromium binary, and intermediate `videos/` are gitignored. The terminal cast's
  small text artifacts (`docs/demo/ack-usage.cast`, `.svg`) are committable; the
  heavier `docs/demo/ack-usage.gif` / `.mp4` are gitignored by default.
- The raw `.webm` is recorded into an OS temp dir and only moved into `docs/demo/`
  after `context.close()` flushes it — so a crash mid-tour won't leave a partial
  file in the repo.
- The script is intentionally resilient: missing selectors and slow loads fall
  back to a load state + timeout, so the recording always runs to completion.
- If the walkthrough hit an error but still produced a video, the script exits
  with code `2` (artifact kept) so callers can notice.
```

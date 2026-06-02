#!/usr/bin/env node
// =============================================================================
// record-demo.mjs — self-contained Playwright demo recorder for ai-core-kit docs
// =============================================================================
//
// Records a narrated-by-motion walkthrough of the Nextra docs site to a .webm
// video. Runs fully OFFLINE / LOCAL: it drives a headless Chromium against a
// docs dev server you start yourself (default http://localhost:3099). It does
// NOT spin up or depend on any remote service.
//
// Output: <OUT>/ack-how-it-works.webm  (default OUT = repo docs/demo/)
//
// Env knobs:
//   BASE_URL  — root URL of the running docs server. Default http://localhost:3099
//   OUT       — directory to drop the final .webm into.
//               Default <repo>/docs/demo
//
// Run:
//   1) In another terminal, serve the docs on BASE_URL's port, e.g.:
//        cd site && npx next dev -p 3099
//   2) npm i && npx playwright install chromium   (first time only)
//   3) npm run record
//
// Design notes:
//   * Every navigation/interaction is wrapped in resilient waits: we try a
//     content selector, then fall back to a load state + fixed timeout, so a
//     slightly-renamed selector never aborts the recording.
//   * Pauses (~1.5-2.5s) + gentle smooth scrolling make the video legible.
//   * The .webm is only flushed to disk when context.close() is called, so all
//     the rename/move logic happens strictly AFTER that.
// =============================================================================

import { chromium } from 'playwright'
import { mkdtemp, mkdir, readdir, rename, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Resolve paths & config
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// scripts/demo/ -> repo root is two levels up.
const REPO_ROOT = path.resolve(__dirname, '..', '..')

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3099').replace(/\/$/, '')
const OUT = process.env.OUT || path.join(REPO_ROOT, 'docs', 'demo')
const OUT_FILE = path.join(OUT, 'ack-how-it-works.webm')

const VIEWPORT = { width: 1366, height: 768 }

// ---------------------------------------------------------------------------
// The tour. Each stop is { path, label, wait } where `wait` is an optional
// best-effort content selector. Routes verified against site/pages/en/* and
// the ground-truth route inventory. NOTE: observability lives under
// /en/reference/ (NOT /en/features/), so we use the real path here.
// ---------------------------------------------------------------------------
const TOUR = [
  { path: '/',                                 label: 'Landing page',        wait: 'main' },
  { path: '/en/getting-started/quickstart',    label: 'Quickstart guide',    wait: 'main' },
  { path: '/en/reference/skills',              label: 'Skills reference',    wait: 'main' },
  { path: '/en/concepts/render-engine',        label: 'Render engine (Mermaid diagram)', wait: 'svg, .mermaid, pre' },
  { path: '/en/features/cost-telemetry',       label: 'Cost telemetry feature', wait: 'main' },
  { path: '/en/reference/observability',       label: 'Observability reference', wait: 'main' },
  { path: '/pt',                               label: 'Language toggle (Português)', wait: 'main' },
]

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------
const log = (...a) => console.log('[record-demo]', ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// A pause in the 1.5-2.5s band so each stop reads comfortably on playback.
const dwell = () => sleep(1500 + Math.floor(Math.random() * 1000))

/**
 * Navigate to a route and settle. Resilient by design: we never throw on a
 * missing selector — we degrade to a load state + a fixed timeout so the
 * recording always continues to the end.
 */
async function goto(page, stop) {
  const url = BASE_URL + stop.path
  log(`-> ${stop.label}  (${url})`)
  try {
    // `networkidle` is ideal for a docs SPA, but can hang behind long-poll
    // dev sockets — cap it and fall back to 'load'.
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 })
  } catch {
    log('   networkidle timed out; falling back to load state')
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 15000 })
    } catch {
      log('   load also timed out; continuing with whatever rendered')
    }
  }

  // Best-effort content selector — purely to confirm something rendered.
  if (stop.wait) {
    try {
      await page.waitForSelector(stop.wait, { timeout: 4000 })
    } catch {
      log(`   selector "${stop.wait}" not found; proceeding anyway`)
    }
  }
}

/**
 * Gentle smooth scroll down then back to top so the viewer's eye can track
 * the page content. Wrapped in try/catch — a scroll failure must never abort.
 */
async function gentleScroll(page) {
  try {
    await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const max = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      )
      const target = Math.min(max - window.innerHeight, 1200)
      if (target > 0) {
        const steps = 8
        for (let i = 1; i <= steps; i++) {
          window.scrollTo({ top: (target * i) / steps, behavior: 'smooth' })
          await sleep(220)
        }
        await sleep(500)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        await sleep(500)
      }
    })
  } catch {
    log('   scroll skipped (page not scriptable)')
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  log(`BASE_URL = ${BASE_URL}`)
  log(`OUT      = ${OUT}`)

  // Per-run temp dir for the raw Playwright .webm; cleaned up at the end.
  const videoDir = await mkdtemp(path.join(tmpdir(), 'ack-demo-'))
  await mkdir(OUT, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: videoDir, size: VIEWPORT },
  })
  const page = await context.newPage()

  let hadError = false
  try {
    // A short opening beat so the video doesn't start mid-load.
    await sleep(800)

    for (const stop of TOUR) {
      await goto(page, stop)
      await dwell()
      await gentleScroll(page)
      await dwell()
    }

    // Closing beat.
    await sleep(1000)
  } catch (err) {
    hadError = true
    log('walkthrough error (will still try to flush video):', err?.message || err)
  } finally {
    // CRITICAL: context.close() is what flushes the .webm to disk.
    await context.close()
    await browser.close()
  }

  // -------------------------------------------------------------------------
  // Locate the produced .webm and move it to OUT/ack-how-it-works.webm
  // -------------------------------------------------------------------------
  let produced
  try {
    const files = (await readdir(videoDir)).filter((f) => f.endsWith('.webm'))
    if (files.length === 0) {
      throw new Error(`no .webm produced in ${videoDir}`)
    }
    produced = path.join(videoDir, files[0])
  } catch (err) {
    log('FATAL: could not find recorded video:', err?.message || err)
    await rm(videoDir, { recursive: true, force: true }).catch(() => {})
    process.exit(1)
  }

  // rename() fails across filesystems (temp dir vs repo); fall back to copy.
  try {
    await rename(produced, OUT_FILE)
  } catch {
    const { copyFile } = await import('node:fs/promises')
    await copyFile(produced, OUT_FILE)
  }
  await rm(videoDir, { recursive: true, force: true }).catch(() => {})

  const { size } = await stat(OUT_FILE)
  const mb = (size / (1024 * 1024)).toFixed(2)
  log('--------------------------------------------------------------')
  log(`Done. Video written to: ${OUT_FILE}`)
  log(`Size: ${mb} MB (${size} bytes)`)
  log('--------------------------------------------------------------')

  // If the walkthrough errored but we still produced a video, surface it via
  // a non-zero exit so CI/callers can notice, while keeping the artifact.
  if (hadError) process.exit(2)
}

main().catch((err) => {
  console.error('[record-demo] unexpected failure:', err)
  process.exit(1)
})

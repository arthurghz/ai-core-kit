# ai-core-kit docs site

The documentation site for **ai-core-kit**, a forkable standard for spinning up
production-grade Claude Code projects. Built with [Nextra 3](https://nextra.site)
(pages directory) + `nextra-theme-docs` on Next.js 14.

This is **META-layer tooling** — the kit's own docs site. It documents how to
*use* ai-core-kit. It is not part of the CHILD payload rendered by `/ack-init`,
and it never lives under `templates/`.

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Other scripts:

```bash
npm run build   # production build
npm run start   # serve the production build
```

Requires Node.js 18.17 or newer.

## Content layout

- `pages/**/*.mdx` — documentation pages (each starts with a top-level `# H1`).
- `pages/_meta.json` — top-level section order and labels.
- Per-directory `_meta.json` files control the order/labels of pages within a
  section. Keys are filenames without the `.mdx` extension; values are sidebar
  labels.
- Internal links are root-relative, e.g. `/getting-started/fork-and-init`.

## Deploy to Vercel

Vercel auto-detects Next.js, so no extra build configuration is required. The
only thing you must set is the **Root Directory**, because this app lives in a
subdirectory of the repo:

1. Import the `ai-core-kit` repository into Vercel.
2. In **Project Settings → Build & Development Settings**, set
   **Root Directory** to `site`.
3. Leave the framework preset as **Next.js** (auto-detected). Build command,
   install command, and output are detected automatically.
4. Deploy. Pull requests get automatic preview deployments.

> Root Directory **must** be `site`. Without it, Vercel will try to build from
> the repo root and fail to find this Next.js app.

The minimal `vercel.json` here only pins the framework to `nextjs` for clarity;
Vercel would detect it regardless.

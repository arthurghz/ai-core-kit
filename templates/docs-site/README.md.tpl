# ${project.name} — docs

A lightweight [Nextra](https://nextra.site) documentation site for **${project.name}**
(archetype: `${archetype}`), scaffolded by [ai-core-kit](https://github.com/arthurghz/ai-core-kit)
via `create-ack`.

## Develop

```sh
npm install
npm run dev
```

Open http://localhost:3000.

## Build

```sh
npm run build
npm run start
```

## Structure

- `pages/en/`, `pages/pt/` — Markdown/MDX content per locale; order via `_meta.js`.
- `theme.config.tsx` — site chrome (logo, footer, head, language selector).
- `next.config.mjs`, `middleware.js` — Nextra 3 i18n wiring.

This site is **yours** — edit it freely. It is generated once at scaffold time and
is not re-rendered by `/ack-init` (the kit manages `project.manifest.yaml`, not
your docs content).

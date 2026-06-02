# Design system — ${project.name}

Fullstack-only subtree. Included only when `design_system.install == true`
(path-segment guard `_when.design_system.install/`, AND render.map.yaml rule with
`requires_archetype: fullstack`). Source: `${design_system.source}`.

This subtree ships ONLY Apache-2.0 example skills WITH NOTICE (manifest findings
21/45) — never docx/pdf/pptx/xlsx-derived (proprietary source-available) content.

## Tokens
Token keys are **snake_case** `^[a-z][a-z0-9_]*$` (decision O4): the lowercase
`${...}` render regex char class `[a-z0-9_]` cannot match a `-`, so a hyphenated
key would be left un-substituted. The JSON-Schema enforces this via
`tokens.propertyNames`.

The brand color is **materialized** by the renderer: `design_system.tokens.color_brand`
is substituted into `theme/globals.css` (carried as `--brand`, wired into `--primary`
via `var(--brand)`) and into `theme/theme.tokens.json`. `/ack-init` always seeds
`color_brand` (default `#0066CC`) whenever the design system is installed, so the
`${design_system.tokens.color_brand}` template var is never unbound. To re-brand,
set the confirmed hex on `design_system.tokens.color_brand` (the `/ack-spec`
`design_brand_color` answer does this) and re-run `/ack-init`; never hand-edit the
generated brand value in the theme files.

<!-- TODO(P4): DEEPER design-system content (real Apache-2.0 example skills,
     component primitives) is deferred. The brand-token materialization gap is
     CLOSED (Phase B): theme/globals.css + theme/theme.tokens.json now carry the
     manifest's color_brand. This skeleton keeps the fullstack-only subtree real
     for the branch-matrix test (T2: design-system present for fullstack, absent
     for backend-api). -->

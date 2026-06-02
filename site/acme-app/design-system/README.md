# Design system — acme-app

Fullstack-only subtree. Included only when `design_system.install == true`
(path-segment guard `_when.design_system.install/`, AND render.map.yaml rule with
`requires_archetype: fullstack`). Source: `design-system`.

This subtree ships ONLY Apache-2.0 example skills WITH NOTICE (manifest findings
21/45) — never docx/pdf/pptx/xlsx-derived (proprietary source-available) content.

## Tokens
Token keys are **snake_case** `^[a-z][a-z0-9_]*$` (decision O4): the lowercase
`${...}` render regex char class `[a-z0-9_]` cannot match a `-`, so a hyphenated
key would be left un-substituted. The JSON-Schema enforces this via
`tokens.propertyNames`.
Tokens are seeded by `/ack-init` (default `{}`); e.g. `color_brand`, `radius_base`.

<!-- TODO(P4): DEEP design-system content (real Apache-2.0 example skills, the
     tokens.json materialized from design_system.tokens, component primitives) is
     deferred to P4. This skeleton keeps the fullstack-only subtree real for the
     branch-matrix test (T2: design-system present for fullstack, absent for
     backend-api). -->

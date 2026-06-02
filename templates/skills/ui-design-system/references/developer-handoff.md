# Developer handoff

> Re-authored for ai-core-kit from alirezarezvani/claude-skills (MIT, © 2025
> Alireza Rezvani). Companion to the `ui-design-system` skill.

How to get the generated tokens from `design-tokens.{json,css,scss}` into a
real codebase, and the checklist that confirms the handoff is complete.

## 1. Export the formats the project consumes

```bash
python3 scripts/design_token_generator.py "#0066CC" --format css  > design-tokens.css
python3 scripts/design_token_generator.py "#0066CC" --format scss > _design-tokens.scss
python3 scripts/design_token_generator.py "#0066CC" --format json > design-tokens.json
```

Generate **only** what the stack needs — a Tailwind project wants `json`; a Sass
pipeline wants `scss`; a vanilla/CSS-in-JS project wants `css`.

## 2. Framework wiring

### CSS custom properties (any stack)

```ts
import "./design-tokens.css"; // exposes :root { --colors-primary-500: … }
```

```css
.btn-primary {
  background: var(--colors-primary-500);
  padding: var(--spacing-2) var(--spacing-4);
  border-radius: var(--borders-radius-DEFAULT);
}
```

### Tailwind (consume the JSON)

```js
// tailwind.config.js
const tokens = require("./design-tokens.json");

module.exports = {
  theme: {
    colors: tokens.colors,
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.fontSize,
    spacing: tokens.spacing,
    borderRadius: tokens.borders.radius,
    boxShadow: tokens.shadows,
    screens: tokens.breakpoints,
  },
};
```

### styled-components (theme provider)

```ts
import tokens from "./design-tokens.json";

const Button = styled.button`
  background: ${tokens.colors.primary["500"]};
  padding: ${tokens.spacing["2"]} ${tokens.spacing["4"]};
  border-radius: ${tokens.borders.radius.DEFAULT};
`;
```

### SCSS

```scss
@use "design-tokens" as t;

.btn-primary {
  background: t.$colors-primary-500;
  padding: t.$spacing-2 t.$spacing-4;
}
```

## 3. Figma sync (Tokens Studio)

1. Install the **Tokens Studio** plugin in Figma.
2. Import `design-tokens.json`.
3. The plugin maps token categories to Figma styles; re-import after each
   regeneration to keep design and code in lockstep.

## 4. Keep regeneration deterministic

The generator is a pure function of `(brand_color, style)` — the same inputs
always produce the same tokens. Commit the **inputs** (the command, or a tiny
`tokens.config` recording brand color + style) and the **generated files**.
When the brand color changes, re-run with the new input and review the diff;
never hand-edit a generated file.

## 5. Handoff checklist

- [ ] Token files committed (`design-tokens.{json,css,scss}` as needed).
- [ ] Brand color + style preset recorded so regeneration is reproducible.
- [ ] Build pipeline imports the tokens (Tailwind config / CSS import / Sass `@use`).
- [ ] Theme or CSS-variable layer wired so components reference tokens only.
- [ ] Component library aligned to the variant/size/state matrix
      (`references/component-architecture.md`).
- [ ] Contrast checked at the AA floor (`references/token-generation.md`).
- [ ] `design_system_doc_template.md` filled and pointing at the exported files.

## 6. Common pitfalls

| Pitfall | Fix |
|---|---|
| Hand-editing a generated token file | Edit the input and regenerate; the file is an artifact. |
| Importing `json` into a project that only ships CSS | Export the matching format instead of bridging at runtime. |
| Magic numbers creeping back into components | Audit for literal px/hex; every value resolves to a token. |
| Dark mode branching inside components | Flip token *values* by theme; components reference semantic roles only. |

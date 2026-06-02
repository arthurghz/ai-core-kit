# Tokens

All token keys are **snake_case** matching `^[a-z][a-z0-9_]*$` (decision O4).
The child renderer's lowercase `${var}` regex (`\$\{([a-z0-9_]+(?:\.[a-z0-9_]+)*)\}`)
cannot match a hyphen, so a hyphenated key like `color-brand` would be left
un-substituted in a `.tpl` file. Snake_case keeps keys render-safe; the
JSON-Schema enforces it via `tokens.propertyNames`. Values below are defaults a
fork overrides through `/ack-init` (seed `{}`); they materialize into
`tokens.json`.

## Color — light theme

| Token              | Default   | Feeds role         |
|--------------------|-----------|--------------------|
| `color_brand`      | `#3b5bdb` | `accent`           |
| `color_brand_dark` | `#2f49af` | `accent_hover`     |
| `color_ink`        | `#14151a` | `text`             |
| `color_ink_muted`  | `#5c6370` | `text_muted`       |
| `color_paper`      | `#ffffff` | `surface`          |
| `color_paper_raised` | `#f6f7f9` | `surface_raised` |
| `color_border`     | `#e3e6ea` | `border`           |
| `color_on_brand`   | `#ffffff` | `text_on_accent`   |
| `color_success`    | `#2f9e44` | `success`          |
| `color_warning`    | `#e8a317` | `warning`          |
| `color_danger`     | `#e03131` | `danger`           |
| `color_info`       | `#1c7ed6` | `info`             |

## Color — dark theme

A parallel set; roles flip rather than components branching on theme.

| Token                   | Default   | Feeds role        |
|-------------------------|-----------|-------------------|
| `color_paper_dark`      | `#14151a` | `surface`         |
| `color_paper_raised_dark` | `#1d1f26` | `surface_raised` |
| `color_ink_dark`        | `#f3f4f6` | `text`            |
| `color_ink_muted_dark`  | `#9aa1ad` | `text_muted`      |
| `color_border_dark`     | `#2a2d35` | `border`          |
| `color_brand_on_dark`   | `#6b86ef` | `accent`          |

## Type scale

| Token               | Default | Role      |
|---------------------|---------|-----------|
| `font_size_display` | `48px`  | `display` |
| `font_size_h1`      | `32px`  | `h1`      |
| `font_size_h2`      | `24px`  | `h2`      |
| `font_size_h3`      | `20px`  | `h3`      |
| `font_size_h4`      | `16px`  | `h4`      |
| `font_size_body_lg` | `18px`  | `body_lg` |
| `font_size_body`    | `16px`  | `body`    |
| `font_size_body_sm` | `14px`  | `body_sm` |
| `font_size_caption` | `12px`  | `caption` |

## Radius

| Token         | Default | Use            |
|---------------|---------|----------------|
| `radius_sm`   | `4px`   | inputs, chips  |
| `radius_base` | `8px`   | default        |
| `radius_lg`   | `16px`  | cards, modals  |
| `radius_pill` | `999px` | pills, avatars |

## Spacing

| Token        | Default | Use                |
|--------------|---------|--------------------|
| `space_base` | `16px`  | base unit          |
| `space_1`    | `4px`   | hairline           |
| `space_2`    | `8px`   | tight              |
| `space_4`    | `16px`  | default gap        |
| `space_8`    | `32px`  | block separation   |

(The full spacing scale is defined in the frontend spacing reference; these
tokens pin the values it uses.)

## tokens.json shape

After `/ack-init`, values materialize into a flat snake_case map:

```json
{
  "color_brand": "#3b5bdb",
  "color_ink": "#14151a",
  "color_paper": "#ffffff",
  "font_size_body": "16px",
  "radius_base": "8px",
  "space_base": "16px"
}
```

Add a token by adding a snake_case key. Never use a hyphen, a leading digit, or
an uppercase letter — all three break either the render regex or the schema's
`propertyNames` pattern.

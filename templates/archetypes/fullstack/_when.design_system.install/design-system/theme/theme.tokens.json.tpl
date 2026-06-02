{
  "$comment": "Mapping doc (NOT a shadcn config). Maps snake_case brand-guideline tokens to the shadcn CSS variables in globals.css. Rendered from theme.tokens.json.tpl: the renderer materializes the confirmed brand color (design_system.tokens.color_brand) into brand.color_brand and color_primary.value below, then byte-sorts the keys. To re-brand: change design_system.tokens.color_brand in the manifest and re-run /ack-init (do not hand-edit the generated brand value). Token keys are snake_case (^[a-z][a-z0-9_]*$, decision O4) so they survive the renderer's lowercase variable-substitution regex (which cannot match a hyphen). shadcn neutral roles use OKLch; the brand color is carried verbatim as the confirmed hex and wired into --primary via var(--brand) in globals.css. Attribution: CSS-variable names follow shadcn/ui (MIT); see ../NOTICE.",
  "brand": {
    "$comment": "The single materialized design token. color_brand is the confirmed brand hex (design_system.tokens.color_brand; default #0066CC). globals.css carries it as --brand and maps --primary to it.",
    "color_brand": "${design_system.tokens.color_brand}"
  },
  "color_space": "oklch",
  "note_on_pairs": "Each surface/role token has a matching *_foreground that must contrast it (text/icon color drawn on top). primary <-> primary_foreground, card <-> card_foreground, etc.",
  "mappings": {
    "color_background": {
      "css_var": "--background",
      "role": "page surface (light theme :root)",
      "oklch_example": "oklch(1 0 0)"
    },
    "color_foreground": {
      "css_var": "--foreground",
      "role": "default text on background",
      "oklch_example": "oklch(0.145 0 0)"
    },
    "color_card": {
      "css_var": "--card",
      "role": "raised surface (cards, panels)",
      "oklch_example": "oklch(1 0 0)"
    },
    "color_card_foreground": {
      "css_var": "--card-foreground",
      "role": "text on card",
      "oklch_example": "oklch(0.145 0 0)"
    },
    "color_popover": {
      "css_var": "--popover",
      "role": "floating surface (menus, dropdowns, tooltips)",
      "oklch_example": "oklch(1 0 0)"
    },
    "color_popover_foreground": {
      "css_var": "--popover-foreground",
      "role": "text on popover",
      "oklch_example": "oklch(0.145 0 0)"
    },
    "color_primary": {
      "css_var": "--primary",
      "role": "primary action / brand accent (maps from brand-guidelines color_brand)",
      "brand_source": "color_brand",
      "value": "${design_system.tokens.color_brand}",
      "oklch_example": "oklch(0.205 0 0)"
    },
    "color_primary_foreground": {
      "css_var": "--primary-foreground",
      "role": "text on primary (maps from brand-guidelines color_on_brand)",
      "brand_source": "color_on_brand",
      "oklch_example": "oklch(0.985 0 0)"
    },
    "color_secondary": {
      "css_var": "--secondary",
      "role": "secondary action surface",
      "oklch_example": "oklch(0.97 0 0)"
    },
    "color_secondary_foreground": {
      "css_var": "--secondary-foreground",
      "role": "text on secondary",
      "oklch_example": "oklch(0.205 0 0)"
    },
    "color_muted": {
      "css_var": "--muted",
      "role": "muted surface (subtle backgrounds)",
      "oklch_example": "oklch(0.97 0 0)"
    },
    "color_muted_foreground": {
      "css_var": "--muted-foreground",
      "role": "secondary/de-emphasized text (maps from brand-guidelines color_ink_muted)",
      "brand_source": "color_ink_muted",
      "oklch_example": "oklch(0.556 0 0)"
    },
    "color_accent": {
      "css_var": "--accent",
      "role": "accent surface (hover/active highlights)",
      "oklch_example": "oklch(0.97 0 0)"
    },
    "color_accent_foreground": {
      "css_var": "--accent-foreground",
      "role": "text on accent",
      "oklch_example": "oklch(0.205 0 0)"
    },
    "color_destructive": {
      "css_var": "--destructive",
      "role": "destructive/danger action (maps from brand-guidelines color_danger)",
      "brand_source": "color_danger",
      "oklch_example": "oklch(0.577 0.245 27.325)"
    },
    "color_destructive_foreground": {
      "css_var": "--destructive-foreground",
      "role": "text on destructive",
      "oklch_example": "oklch(0.985 0 0)"
    },
    "color_border": {
      "css_var": "--border",
      "role": "default border/divider (maps from brand-guidelines color_border)",
      "brand_source": "color_border",
      "oklch_example": "oklch(0.922 0 0)"
    },
    "color_input": {
      "css_var": "--input",
      "role": "form-control border",
      "oklch_example": "oklch(0.922 0 0)"
    },
    "color_ring": {
      "css_var": "--ring",
      "role": "focus ring",
      "oklch_example": "oklch(0.708 0 0)"
    },
    "color_chart_1": { "css_var": "--chart-1", "role": "data series 1", "oklch_example": "oklch(0.646 0.222 41.116)" },
    "color_chart_2": { "css_var": "--chart-2", "role": "data series 2", "oklch_example": "oklch(0.6 0.118 184.704)" },
    "color_chart_3": { "css_var": "--chart-3", "role": "data series 3", "oklch_example": "oklch(0.398 0.07 227.392)" },
    "color_chart_4": { "css_var": "--chart-4", "role": "data series 4", "oklch_example": "oklch(0.828 0.189 84.429)" },
    "color_chart_5": { "css_var": "--chart-5", "role": "data series 5", "oklch_example": "oklch(0.769 0.188 70.08)" },
    "color_sidebar": { "css_var": "--sidebar", "role": "sidebar surface", "oklch_example": "oklch(0.985 0 0)" },
    "color_sidebar_foreground": { "css_var": "--sidebar-foreground", "role": "text on sidebar", "oklch_example": "oklch(0.145 0 0)" },
    "color_sidebar_primary": { "css_var": "--sidebar-primary", "role": "sidebar primary accent", "oklch_example": "oklch(0.205 0 0)" },
    "color_sidebar_primary_foreground": { "css_var": "--sidebar-primary-foreground", "role": "text on sidebar primary", "oklch_example": "oklch(0.985 0 0)" },
    "color_sidebar_accent": { "css_var": "--sidebar-accent", "role": "sidebar accent surface", "oklch_example": "oklch(0.97 0 0)" },
    "color_sidebar_accent_foreground": { "css_var": "--sidebar-accent-foreground", "role": "text on sidebar accent", "oklch_example": "oklch(0.205 0 0)" },
    "color_sidebar_border": { "css_var": "--sidebar-border", "role": "sidebar border", "oklch_example": "oklch(0.922 0 0)" },
    "color_sidebar_ring": { "css_var": "--sidebar-ring", "role": "sidebar focus ring", "oklch_example": "oklch(0.708 0 0)" },
    "radius_base": {
      "css_var": "--radius",
      "role": "base corner radius; --radius-sm/md/lg/xl derive from it via calc() (maps from brand-guidelines radius_base)",
      "brand_source": "radius_base",
      "value_example": "0.625rem"
    }
  },
  "derived_radii": {
    "$comment": "Not directly brand-mapped; computed from radius_base in the @theme inline block of globals.css. Listed for reference only.",
    "radius_sm": { "css_var": "--radius-sm", "formula": "calc(var(--radius) - 4px)" },
    "radius_md": { "css_var": "--radius-md", "formula": "calc(var(--radius) - 2px)" },
    "radius_lg": { "css_var": "--radius-lg", "formula": "var(--radius)" },
    "radius_xl": { "css_var": "--radius-xl", "formula": "calc(var(--radius) + 4px)" }
  }
}

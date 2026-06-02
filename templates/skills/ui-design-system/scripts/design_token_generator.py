#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Re-authored for ai-core-kit from alirezarezvani/claude-skills
# (product-team/skills/ui-design-system), Copyright (c) 2025 Alireza Rezvani (MIT).
"""Design-token generator — turn one brand color into a full token system.

Stdlib only (``colorsys``). Generates color scales, a modular type scale, an
8pt spacing grid, sizing, borders, shadows, animation, breakpoints, and a
z-index scale, then exports them as JSON, CSS custom properties, or SCSS
variables.

Usage:
    python3 design_token_generator.py [brand_color]
                                       [--style modern|classic|playful]
                                       [--format json|css|scss|summary]

Examples:
    python3 design_token_generator.py "#0066CC" --format summary
    python3 design_token_generator.py "#8B4513" --style classic --format css
    python3 design_token_generator.py "#FF6B6B" --style playful --format json
"""
from __future__ import annotations

import argparse
import colorsys
import json
from typing import Dict, List, Tuple

COLOR_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

FONT_FAMILIES = {
    "modern": {
        "sans": "Inter, system-ui, -apple-system, sans-serif",
        "serif": "Merriweather, Georgia, serif",
        "mono": "Fira Code, Monaco, monospace",
    },
    "classic": {
        "sans": "Helvetica, Arial, sans-serif",
        "serif": "Times New Roman, Times, serif",
        "mono": "Courier New, monospace",
    },
    "playful": {
        "sans": "Poppins, Roboto, sans-serif",
        "serif": "Playfair Display, Georgia, serif",
        "mono": "Source Code Pro, monospace",
    },
}

RADII = {
    "modern": {"none": "0", "sm": "4px", "DEFAULT": "8px", "md": "12px",
               "lg": "16px", "xl": "24px", "full": "9999px"},
    "classic": {"none": "0", "sm": "2px", "DEFAULT": "4px", "md": "6px",
                "lg": "8px", "xl": "12px", "full": "9999px"},
    "playful": {"none": "0", "sm": "8px", "DEFAULT": "16px", "md": "20px",
                "lg": "24px", "xl": "32px", "full": "9999px"},
}

SHADOWS = {
    "modern": {
        "none": "none",
        "sm": "0 1px 2px 0 rgba(0,0,0,0.05)",
        "DEFAULT": "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)",
        "md": "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
        "lg": "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
        "xl": "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
        "2xl": "0 25px 50px -12px rgba(0,0,0,0.25)",
        "inner": "inset 0 2px 4px 0 rgba(0,0,0,0.06)",
    },
    "classic": {
        "none": "none",
        "sm": "0 1px 2px rgba(0,0,0,0.1)",
        "DEFAULT": "0 2px 4px rgba(0,0,0,0.1)",
        "md": "0 4px 8px rgba(0,0,0,0.1)",
        "lg": "0 8px 16px rgba(0,0,0,0.1)",
        "xl": "0 16px 32px rgba(0,0,0,0.1)",
    },
    "playful": {
        "none": "none",
        "sm": "0 2px 6px rgba(0,0,0,0.08)",
        "DEFAULT": "0 4px 12px rgba(0,0,0,0.12)",
        "md": "0 8px 20px rgba(0,0,0,0.14)",
        "lg": "0 14px 30px rgba(0,0,0,0.16)",
        "xl": "0 24px 48px rgba(0,0,0,0.18)",
    },
}

BASE_UNIT = 8          # 8pt grid
TYPE_RATIO = 1.25      # major third
BASE_FONT = 16         # px


def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    h = hex_color.lstrip("#")
    if len(h) != 6:
        raise ValueError(f"expected #RRGGBB, got '{hex_color}'")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def rgb_to_hex(rgb: List[int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*(max(0, min(255, c)) for c in rgb))


def adjust_hue(hex_color: str, degrees: int) -> str:
    r, g, b = hex_to_rgb(hex_color)
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    h = (h + degrees / 360) % 1
    nr, ng, nb = colorsys.hsv_to_rgb(h, s, v)
    return rgb_to_hex([int(nr * 255), int(ng * 255), int(nb * 255)])


def color_scale(base_color: str) -> Dict[str, str]:
    r, g, b = hex_to_rgb(base_color)
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    scale: Dict[str, str] = {}
    for step in COLOR_STEPS:
        new_v = 0.95 if step < 500 else v * (1 - (step - 500) / 500)
        new_s = s * (0.3 + 0.7 * (step / 900))
        nr, ng, nb = colorsys.hsv_to_rgb(h, new_s, new_v)
        scale[str(step)] = rgb_to_hex([int(nr * 255), int(ng * 255), int(nb * 255)])
    scale["DEFAULT"] = base_color
    return scale


def neutral_scale() -> Dict[str, str]:
    return {
        "50": "#F9FAFB", "100": "#F3F4F6", "200": "#E5E7EB", "300": "#D1D5DB",
        "400": "#9CA3AF", "500": "#6B7280", "600": "#4B5563", "700": "#374151",
        "800": "#1F2937", "900": "#111827", "DEFAULT": "#6B7280",
    }


def colors(brand_color: str) -> Dict:
    return {
        "primary": color_scale(brand_color),
        "secondary": color_scale(adjust_hue(brand_color, 180)),
        "neutral": neutral_scale(),
        "semantic": {
            "success": {"base": "#10B981", "light": "#34D399", "dark": "#059669", "contrast": "#FFFFFF"},
            "warning": {"base": "#F59E0B", "light": "#FBBD24", "dark": "#D97706", "contrast": "#FFFFFF"},
            "error":   {"base": "#EF4444", "light": "#F87171", "dark": "#DC2626", "contrast": "#FFFFFF"},
            "info":    {"base": "#3B82F6", "light": "#60A5FA", "dark": "#2563EB", "contrast": "#FFFFFF"},
        },
        "surface": {
            "background": "#FFFFFF", "foreground": "#111827", "card": "#FFFFFF",
            "overlay": "rgba(0,0,0,0.5)", "divider": "#E5E7EB",
        },
    }


def type_scale() -> Dict[str, str]:
    sizes = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"]
    base_i = sizes.index("base")
    scale: Dict[str, str] = {}
    for i, size in enumerate(sizes):
        if i == base_i:
            scale[size] = f"{BASE_FONT}px"
        elif i < base_i:
            scale[size] = f"{round(BASE_FONT / (TYPE_RATIO ** (base_i - i)))}px"
        else:
            scale[size] = f"{round(BASE_FONT * (TYPE_RATIO ** (i - base_i)))}px"
    return scale


def typography(style: str) -> Dict:
    return {
        "fontFamily": FONT_FAMILIES.get(style, FONT_FAMILIES["modern"]),
        "fontSize": type_scale(),
        "fontWeight": {"thin": 100, "light": 300, "normal": 400, "medium": 500,
                       "semibold": 600, "bold": 700, "extrabold": 800, "black": 900},
        "lineHeight": {"none": 1, "tight": 1.25, "snug": 1.375, "normal": 1.5,
                       "relaxed": 1.625, "loose": 2},
        "letterSpacing": {"tighter": "-0.05em", "tight": "-0.025em", "normal": "0",
                          "wide": "0.025em", "wider": "0.05em", "widest": "0.1em"},
    }


def spacing() -> Dict[str, str]:
    mults = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 20, 24, 32, 40, 48, 56, 64]
    out = {str(i): f"{int(BASE_UNIT * m)}px" for i, m in enumerate(mults)}
    out.update({"xs": out["1"], "sm": out["2"], "md": out["4"], "lg": out["6"],
                "xl": out["8"], "2xl": out["12"], "3xl": out["16"]})
    return out


def sizing() -> Dict:
    return {
        "container": {"sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px", "2xl": "1536px"},
        "components": {
            "button": {"sm": {"height": "32px", "paddingX": "12px"},
                       "md": {"height": "40px", "paddingX": "16px"},
                       "lg": {"height": "48px", "paddingX": "20px"}},
            "input": {"sm": {"height": "32px", "paddingX": "12px"},
                      "md": {"height": "40px", "paddingX": "16px"},
                      "lg": {"height": "48px", "paddingX": "20px"}},
            "icon": {"sm": "16px", "md": "20px", "lg": "24px", "xl": "32px"},
        },
    }


def borders(style: str) -> Dict:
    return {
        "radius": RADII.get(style, RADII["modern"]),
        "width": {"none": "0", "thin": "1px", "DEFAULT": "1px", "medium": "2px", "thick": "4px"},
    }


def animation() -> Dict:
    return {
        "duration": {"instant": "0ms", "fast": "150ms", "DEFAULT": "250ms",
                     "slow": "350ms", "slower": "500ms"},
        "easing": {"linear": "linear", "ease": "ease", "easeIn": "ease-in",
                   "easeOut": "ease-out", "easeInOut": "ease-in-out",
                   "spring": "cubic-bezier(0.68,-0.55,0.265,1.55)"},
    }


def breakpoints() -> Dict[str, str]:
    return {"xs": "480px", "sm": "640px", "md": "768px",
            "lg": "1024px", "xl": "1280px", "2xl": "1536px"}


def z_index() -> Dict[str, int]:
    return {"hide": -1, "base": 0, "dropdown": 1000, "sticky": 1020, "overlay": 1030,
            "modal": 1040, "popover": 1050, "tooltip": 1060, "notification": 1070}


def build(brand_color: str, style: str) -> Dict:
    return {
        "meta": {"style": style, "brandColor": brand_color, "baseUnit": BASE_UNIT,
                 "typeScaleRatio": TYPE_RATIO},
        "colors": colors(brand_color),
        "typography": typography(style),
        "spacing": spacing(),
        "sizing": sizing(),
        "borders": borders(style),
        "shadows": SHADOWS.get(style, SHADOWS["modern"]),
        "animation": animation(),
        "breakpoints": breakpoints(),
        "zIndex": z_index(),
    }


def _flatten(obj: Dict, prefix: str = "") -> List[Tuple[str, str]]:
    out: List[Tuple[str, str]] = []
    for key, value in obj.items():
        path = f"{prefix}-{key}" if prefix else str(key)
        if isinstance(value, dict):
            out.extend(_flatten(value, path))
        else:
            out.append((path, str(value)))
    return out


def export_css(tokens: Dict) -> str:
    lines = [":root {"]
    lines += [f"  --{name}: {val};" for name, val in _flatten(tokens)]
    lines.append("}")
    return "\n".join(lines)


def export_scss(tokens: Dict) -> str:
    return "\n".join(f"${name}: {val};" for name, val in _flatten(tokens))


def export_summary(tokens: Dict, brand_color: str, style: str) -> str:
    return "\n".join([
        "=" * 56,
        "DESIGN-TOKEN SYSTEM",
        "=" * 56,
        f"  Style:       {style}",
        f"  Brand color: {brand_color}",
        "",
        f"  Color palettes: {len(tokens['colors'])}",
        f"  Type sizes:     {len(tokens['typography']['fontSize'])}",
        f"  Spacing steps:  {len(tokens['spacing'])}",
        f"  Shadows:        {len(tokens['shadows'])}",
        f"  Breakpoints:    {len(tokens['breakpoints'])}",
        "",
        "  Export formats: json | css | scss",
    ])


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("brand_color", nargs="?", default="#0066CC", help="hex brand color (default #0066CC)")
    p.add_argument("--style", choices=["modern", "classic", "playful"], default="modern")
    p.add_argument("--format", dest="fmt", choices=["json", "css", "scss", "summary"], default="json")
    args = p.parse_args()

    tokens = build(args.brand_color, args.style)
    if args.fmt == "json":
        print(json.dumps(tokens, indent=2))
    elif args.fmt == "css":
        print(export_css(tokens))
    elif args.fmt == "scss":
        print(export_scss(tokens))
    else:
        print(export_summary(tokens, args.brand_color, args.style))


if __name__ == "__main__":
    main()

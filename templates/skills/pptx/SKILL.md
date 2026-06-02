---
name: pptx
description: >
  Create and edit PowerPoint (.pptx) presentations programmatically with
  open-source libraries — python-pptx (Python) or pptxgenjs (Node/TypeScript) —
  covering slides and layouts, title/content placeholders, formatted text
  frames, images, tables, native charts, speaker notes, and slide masters /
  templates. Use when a task asks to generate a deck, build slides from data,
  fill a branded .pptx template, or export a report as PowerPoint. Trigger on
  "make a PowerPoint", "generate a .pptx", "build a slide deck", "create a
  presentation", "fill this pptx template", or "export these charts to slides".
  Do NOT use for Word/.docx, Excel/.xlsx, or PDF output (those are separate
  skills), for reading/parsing decks for analysis only, or for live Google
  Slides editing.
license: Apache-2.0
---

# PowerPoint (.pptx) generation

Build `.pptx` decks from code using permissively licensed open-source libraries.
Pick one stack for the whole task — do not mix them in one file.

- **Python → `python-pptx`** (MIT). Best for editing an existing branded
  template, precise placeholder/layout control, and reading decks back.
- **Node / TypeScript → `pptxgenjs`** (MIT). Best for JS/TS pipelines and
  generating a deck from scratch with a fluent API. It cannot open and edit an
  existing `.pptx`.

Both write the OpenXML `.pptx` format Microsoft PowerPoint, Keynote, LibreOffice
Impress, and Google Slides all open. No copy of PowerPoint is required.

## When to activate

- Generating a presentation or report deck from data, JSON, or markdown.
- Filling a supplied branded `.pptx` template (logos, master slides, theme).
- Adding slides, tables, charts, images, or speaker notes to a deck.
- Converting tabular/metric data into native, editable PowerPoint charts.

## When NOT to use

- Word `.docx`, Excel `.xlsx`, or PDF output — use the matching skill.
- Reading a deck only to summarize/analyze its content (parsing, not authoring).
- Live editing of Google Slides or Keynote-native files.

## Install

```bash
# Python (3.9+)
pip install python-pptx          # imports as `pptx`; also pulls in Pillow, lxml

# Node (16+)
npm install pptxgenjs            # CommonJS + ESM + browser bundle
```

`python-pptx` needs `Pillow` (installed automatically) to embed images.
Charts in `python-pptx` need no extra dependency — they are written as native
OpenXML chart parts that PowerPoint renders and lets the user re-edit.

## Core model (read this before writing code)

A `.pptx` is `Presentation → Slides → Shapes`. You almost never set raw
positions blindly:

- A **slide layout** comes from a **slide master** and defines **placeholders**
  (title, body, picture, etc.) by `idx`. Adding a slide from a layout gives you
  those placeholders pre-positioned and pre-styled by the template.
- Prefer **placeholders** over free-floating text boxes when a layout/template
  exists — that is what makes output match the brand and stay editable.
- All geometry is **EMU** (English Metric Units). Always use unit helpers
  (`Inches`, `Pt`, `Cm` / `pptxgenjs` inch-or-percent values) — never raw EMUs.

## Minimal example — Python (`python-pptx`)

```python
from pptx import Presentation
from pptx.util import Inches, Pt

prs = Presentation()                       # blank deck w/ default template
                                           # or: Presentation("template.pptx")

# Title slide — layout 0 in the default template.
title_slide = prs.slides.add_slide(prs.slide_layouts[0])
title_slide.shapes.title.text = "Quarterly Review"
title_slide.placeholders[1].text = "FY26 Q1 · Prepared by Ops"   # subtitle

# Title + content slide — layout 1; placeholder idx 1 is the body.
body_slide = prs.slides.add_slide(prs.slide_layouts[1])
body_slide.shapes.title.text = "Highlights"
tf = body_slide.placeholders[1].text_frame
tf.text = "Revenue up 23% YoY"             # first paragraph
p = tf.add_paragraph()
p.text = "Churn down to 1.8%"
p.level = 1                                 # indent / sub-bullet
p.font.size = Pt(18)

# Speaker notes.
body_slide.notes_slide.notes_text_frame.text = "Lead with the revenue number."

prs.save("review.pptx")
```

## Minimal example — Node (`pptxgenjs`)

```js
const PptxGenJS = require("pptxgenjs");   // ESM: import PptxGenJS from "pptxgenjs";

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
pptx.layout = "WIDE";                       // 16:9; default is "LAYOUT_16x9"

// Title slide.
const title = pptx.addSlide();
title.addText("Quarterly Review", { x: 0.5, y: 2.6, w: 12.3, h: 1.2,
  fontSize: 40, bold: true, align: "center" });
title.addText("FY26 Q1 · Prepared by Ops", { x: 0.5, y: 3.9, w: 12.3, h: 0.6,
  fontSize: 18, color: "666666", align: "center" });

// Content slide with bullets (one addText call, array of lines).
const body = pptx.addSlide();
body.addText("Highlights", { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true });
body.addText(
  [
    { text: "Revenue up 23% YoY", options: { bullet: true } },
    { text: "Churn down to 1.8%", options: { bullet: true, indentLevel: 1 } },
  ],
  { x: 0.7, y: 1.3, w: 12, h: 4, fontSize: 18 },
);
body.addNotes("Lead with the revenue number.");

pptx.writeFile({ fileName: "review.pptx" });  // returns a Promise
```

## Choosing placeholders vs. text boxes

| Situation | Do this |
|---|---|
| A template/layout defines the slot | Write into the **placeholder** (`shapes.title`, `placeholders[idx]`) |
| No layout slot exists / free design | Add a **text box** (`add_textbox` / `addText`) at explicit coords |
| Unsure which `idx` is which | Iterate placeholders and print `placeholder_format.idx` + `.type` (recipe in references) |

In `python-pptx`, placeholder indices are template-specific. The default
template's common layouts: `0` Title, `1` Title+Content, `5` Title Only,
`6` Blank. Body placeholders are usually `idx == 1`. **Always confirm by
inspecting the actual template** rather than assuming.

## Common pitfalls

- **Mixing libraries.** Generate a given file with one library only.
- **Hard-coded layout indices on a custom template.** Inspect the template's
  layouts/placeholders first; indices differ per template.
- **Raw EMUs.** Use `Inches`/`Pt`/`Cm` (py) or inch/percent values (node).
- **`pptxgenjs` cannot edit an existing deck** — if the task is "fill this
  template", you must use `python-pptx`.
- **Overflowing text frames.** Set autofit / word-wrap or size the frame; pptx
  does not reflow across slides for you. See the autofit recipe.
- **Forgetting `notes_slide` is lazy.** Accessing `slide.notes_slide` creates it
  on first touch in `python-pptx` — that is expected.
- **`writeFile` is async** in `pptxgenjs`; `await` it (or use `.then`) before the
  process exits, or the file may be truncated.
- **Image aspect ratio.** Set only `width` (or only `height`) to scale
  proportionally; setting both can distort.

## Recipes

Concrete, copy-pasteable recipes for both stacks live in
[`references/recipes.md`](references/recipes.md):

- Presentation & slides from layouts; inspecting a template's layouts/placeholders
- Title/content placeholders and the blank-layout text-box fallback
- Text frames: paragraphs, runs, bullets, levels, font color/size/bold, alignment, autofit
- Images: from file, from a stream/buffer, proportional sizing, backgrounds
- Tables: build from a 2-D array, header styling, column widths, cell fills
- Charts: bar/column, line, pie — native editable charts in both libraries
- Speaker notes
- Slide masters & templates: starting from a branded `.pptx`, cloning a layout
- Saving to a file vs. an in-memory stream (web responses)

## Checklist

Before returning a generated deck:

- [ ] One library per output file (no python-pptx + pptxgenjs mixing).
- [ ] Used placeholders where the template/layout provides them.
- [ ] All sizes via unit helpers, not raw EMUs.
- [ ] Images scaled proportionally (one dimension, or matched aspect ratio).
- [ ] Tables/charts carry headers/labels and fit the slide bounds.
- [ ] Speaker notes added where the task asked for them.
- [ ] `pptxgenjs` `writeFile`/`write` is awaited before exit.
- [ ] Opened the result once (PowerPoint/Impress/Slides) or asserted shape/slide
      counts to confirm it is not corrupt.

## Related skills

- `docx`, `xlsx`, `pdf` — the sibling document-generation skills.
- `ui-design-system` — brand tokens (colors, type) to keep a deck on-brand.

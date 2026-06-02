# pptx recipes — python-pptx (MIT) & pptxgenjs (MIT)

Concrete recipes for generating `.pptx`. Each topic shows **Python** first
(`python-pptx`) then **Node** (`pptxgenjs`). Use one library per output file.

- `python-pptx` docs: https://python-pptx.readthedocs.io — license: MIT.
- `pptxgenjs` docs: https://gitbrent.github.io/PptxGenJS — license: MIT.

Conventions used below:
- Python imports assumed once: `from pptx.util import Inches, Pt, Emu` and color
  `from pptx.dml.color import RGBColor`.
- Node: `const PptxGenJS = require("pptxgenjs");` (or ESM `import`).
- `pptxgenjs` coordinates are **inches** by default (numbers), or strings like
  `"50%"` for percent-of-slide. Colors are 6-hex strings **without** `#`.

---

## 1. Presentation & slides from layouts

### Python

```python
from pptx import Presentation
from pptx.util import Inches, Pt

prs = Presentation()                 # blank deck, built-in default template
# prs = Presentation("brand.pptx")   # start from a branded template instead

# Default 16:9? The built-in template is 4:3 (10x7.5in). Force 16:9:
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

slide = prs.slides.add_slide(prs.slide_layouts[1])   # add a slide from a layout
prs.save("out.pptx")
```

`prs.slide_layouts` is the list of layouts on the **first** slide master.
`prs.slide_masters[i].slide_layouts` reaches layouts on other masters.

### Node

```js
const pptx = new PptxGenJS();

// Built-in layouts: "LAYOUT_16x9" (default, 10x5.63), "LAYOUT_16x10",
// "LAYOUT_4x3", "LAYOUT_WIDE" (13.33x7.5). Or define your own:
pptx.defineLayout({ name: "A4LAND", width: 11.7, height: 8.27 });
pptx.layout = "LAYOUT_WIDE";

pptx.author = "Ops";          // document metadata (optional)
pptx.title = "Quarterly Review";

const slide = pptx.addSlide();
slide.background = { color: "FFFFFF" };       // or { path }/{ data } for image bg
slide.addText("Hello", { x: 1, y: 1, w: 8, h: 1, fontSize: 24 });
```

`pptxgenjs` has no concept of "open an existing file". For template-driven work
use `python-pptx`, or replicate the template with `defineSlideMaster` (§9).

---

## 2. Inspect a template's layouts & placeholders (python-pptx)

Indices are **template-specific**. Print them before writing into a custom deck.

```python
from pptx import Presentation
prs = Presentation("brand.pptx")

for li, layout in enumerate(prs.slide_layouts):
    print(f"layout[{li}] = {layout.name!r}")
    for ph in layout.placeholders:
        pf = ph.placeholder_format
        print(f"    idx={pf.idx:2d}  type={pf.type}  name={ph.name!r}")
```

`placeholder_format.type` values include `TITLE (13)`, `BODY (2)`,
`SUBTITLE (4)`, `CENTER_TITLE (1)`, `PICTURE (18)`, `OBJECT (7)`,
`CHART`, `TABLE`. To find the body placeholder, look for `type == BODY` or
the lowest non-title `idx` (commonly `1`).

After `add_slide`, the new slide exposes the same placeholders:

```python
slide = prs.slides.add_slide(prs.slide_layouts[1])
for ph in slide.placeholders:
    print(ph.placeholder_format.idx, ph.name)   # write via slide.placeholders[idx]
```

---

## 3. Title / content placeholders

### Python

```python
slide = prs.slides.add_slide(prs.slide_layouts[1])    # Title and Content
slide.shapes.title.text = "Agenda"                    # the title placeholder
body = slide.placeholders[1]                          # body placeholder
body.text = "Q1 results"                              # sets first paragraph

# A "Title Only" (idx 5) or "Blank" (idx 6) layout has no body placeholder —
# add a textbox (see §5) for free content.
```

If a placeholder slot was deleted from the layout, accessing it raises
`KeyError`; guard with `if idx in [p.placeholder_format.idx for p in slide.placeholders]`.

### Node

`pptxgenjs` placeholders only exist when defined on a slide master (§9). Then:

```js
const slide = pptx.addSlide({ masterName: "BRAND" });
slide.addText("Agenda", { placeholder: "title" });          // by placeholder name
slide.addText("Q1 results", { placeholder: "body" });
```

Without a master, just place text boxes at explicit coordinates (§5).

---

## 4. Text frames: paragraphs, runs, formatting

### Python

A shape's `text_frame` holds paragraphs; each paragraph holds runs. Format at the
run level for mixed styling within a line.

```python
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Pt
from pptx.dml.color import RGBColor

tf = body.text_frame
tf.word_wrap = True

tf.text = "First bullet"                 # replaces all paragraphs with one
p0 = tf.paragraphs[0]
p0.font.size = Pt(20); p0.font.bold = True
p0.font.color.rgb = RGBColor(0x1F, 0x49, 0x7D)
p0.alignment = PP_ALIGN.LEFT

p1 = tf.add_paragraph()
p1.text = "Sub-bullet"
p1.level = 1                             # 0..8 indent level
p1.font.size = Pt(16)

# Mixed runs in one paragraph:
p2 = tf.add_paragraph()
r = p2.add_run(); r.text = "Bold "; r.font.bold = True
r2 = p2.add_run(); r2.text = "and normal"

# Vertical anchor of the whole frame:
tf.vertical_anchor = MSO_ANCHOR.MIDDLE
```

Autofit so text shrinks to fit the frame (avoids overflow off-slide):

```python
from pptx.enum.text import MSO_AUTO_SIZE
tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE   # shrink text to shape
# or MSO_AUTO_SIZE.SHAPE_TO_FIT_TEXT  (grow shape)
# or MSO_AUTO_SIZE.NONE                (no autofit; clip/overflow)
```

Note: `TEXT_TO_FIT_SHAPE` ("Shrink text on overflow") is honored by PowerPoint
at display time; the actual font scale is computed by PowerPoint, not the file.

### Node

```js
slide.addText(
  [
    { text: "First bullet", options: { bullet: true, bold: true, color: "1F497D" } },
    { text: "Sub-bullet",  options: { bullet: true, indentLevel: 1, fontSize: 16 } },
    // mixed runs share a paragraph by setting breakLine:false on the prior part
    { text: "Bold ",       options: { bold: true, breakLine: false } },
    { text: "and normal",  options: { bold: false } },
  ],
  { x: 0.7, y: 1.3, w: 11, h: 4, fontSize: 20, align: "left", valign: "top",
    fit: "shrink",            // "none" | "shrink" | "resize"  (autofit)
    paraSpaceAfter: 6 },
);

// Custom bullet glyph / numbering:
slide.addText("Step one", { x: 1, y: 5, w: 8, h: 0.5,
  bullet: { type: "number", style: "arabicPeriod", startAt: 1 } });
slide.addText("Dash item", { x: 1, y: 5.6, w: 8, h: 0.5,
  bullet: { characterCode: "2013" } });   // en-dash bullet
```

---

## 5. Text box fallback (no placeholder)

### Python

```python
left, top, width, height = Inches(1), Inches(1), Inches(8), Inches(1.2)
tb = slide.shapes.add_textbox(left, top, width, height)
tf = tb.text_frame
tf.text = "Free-floating heading"
tf.paragraphs[0].font.size = Pt(28)
tf.margin_left = Inches(0.1)             # internal padding
```

### Node

```js
slide.addText("Free-floating heading",
  { x: 1, y: 1, w: 8, h: 1.2, fontSize: 28 });
// shapes/lines too:
slide.addShape(pptx.ShapeType.rect, { x: 1, y: 3, w: 4, h: 1.5,
  fill: { color: "EEEEEE" }, line: { color: "999999", width: 1 } });
```

---

## 6. Images

### Python

```python
# From a file path; give ONE dimension to scale proportionally.
slide.shapes.add_picture("logo.png", Inches(0.5), Inches(0.4), height=Inches(0.8))

# Both dims = exact box (may distort):
slide.shapes.add_picture("hero.jpg", Inches(1), Inches(1.5),
                         width=Inches(8), height=Inches(4.5))

# From an in-memory stream (e.g. a generated chart PNG):
import io
buf = io.BytesIO(png_bytes)
slide.shapes.add_picture(buf, Inches(1), Inches(1), width=Inches(6))
```

Full-bleed background image: place a picture at `(0,0)` sized to
`prs.slide_width/height`, then send it behind other shapes by inserting its
XML element first (advanced) or just add it before other content.

### Node

```js
slide.addImage({ path: "logo.png", x: 0.5, y: 0.4, h: 0.8 });    // proportional via h only
slide.addImage({ path: "hero.jpg", x: 1, y: 1.5, w: 8, h: 4.5 });

// From base64 data (no filesystem):
slide.addImage({ data: "image/png;base64,iVBORw0K...", x: 1, y: 1, w: 6 });

// Sizing mode to fit/crop within a box:
slide.addImage({ path: "hero.jpg", x: 1, y: 1, w: 6, h: 3,
  sizing: { type: "cover", w: 6, h: 3 } });   // "contain" | "cover" | "crop"

// Slide background image:
const s = pptx.addSlide();
s.background = { path: "bg.jpg" };             // or { data: "..." }
```

---

## 7. Tables

### Python

```python
data = [
    ["Region", "Q1", "Q2"],
    ["NA", "1.2M", "1.4M"],
    ["EMEA", "0.9M", "1.1M"],
]
rows, cols = len(data), len(data[0])
left, top, width, height = Inches(0.5), Inches(1.5), Inches(9), Inches(0.8)
gf = slide.shapes.add_table(rows, cols, left, top, width, height)
table = gf.table

for r, row in enumerate(data):
    for c, val in enumerate(row):
        cell = table.cell(r, c)
        cell.text = str(val)
        cell.text_frame.paragraphs[0].font.size = Pt(14)

# Header row styling.
from pptx.dml.color import RGBColor
for c in range(cols):
    hdr = table.cell(0, c)
    hdr.fill.solid()
    hdr.fill.fore_color.rgb = RGBColor(0x1F, 0x49, 0x7D)
    para = hdr.text_frame.paragraphs[0]
    para.font.bold = True
    para.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

# Column widths (override even distribution).
table.columns[0].width = Inches(3)
table.columns[1].width = Inches(3)
table.columns[2].width = Inches(3)

# Merge a span of cells:
table.cell(0, 1).merge(table.cell(0, 2))
```

`first_row`, `horz_banding` styling toggles live on `table` (e.g.
`table.first_row = True`).

### Node

```js
const rows = [
  // Header row with cell options.
  [ { text: "Region", options: { bold: true, color: "FFFFFF", fill: { color: "1F497D" } } },
    { text: "Q1", options: { bold: true, color: "FFFFFF", fill: { color: "1F497D" } } },
    { text: "Q2", options: { bold: true, color: "FFFFFF", fill: { color: "1F497D" } } } ],
  ["NA", "1.2M", "1.4M"],
  ["EMEA", "0.9M", "1.1M"],
];
slide.addTable(rows, {
  x: 0.5, y: 1.5, w: 9,
  colW: [3, 3, 3],
  border: { type: "solid", color: "CCCCCC", pt: 1 },
  fontSize: 14,
  autoPage: true,        // overflow long tables onto new slides automatically
});
```

`autoPage: true` is unique to `pptxgenjs` — long tables flow onto added slides.

---

## 8. Charts (native, editable)

Both libraries embed **native OpenXML charts** the user can re-edit in
PowerPoint — not flat images.

### Python

```python
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION

chart_data = CategoryChartData()
chart_data.categories = ["Q1", "Q2", "Q3", "Q4"]
chart_data.add_series("2025", (1.2, 1.4, 1.6, 1.9))
chart_data.add_series("2026", (1.5, 1.7, 2.0, 2.3))

x, y, cx, cy = Inches(1), Inches(1.5), Inches(8), Inches(4.5)
gf = slide.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, x, y, cx, cy, chart_data)
chart = gf.chart
chart.has_legend = True
chart.legend.position = XL_LEGEND_POSITION.BOTTOM
chart.legend.include_in_layout = False

plot = chart.plots[0]
plot.has_data_labels = True
plot.data_labels.number_format = '0.0"M"'
```

Common `XL_CHART_TYPE` values: `COLUMN_CLUSTERED`, `COLUMN_STACKED`,
`BAR_CLUSTERED`, `LINE`, `LINE_MARKERS`, `PIE`, `XY_SCATTER`, `AREA`,
`DOUGHNUT`, `RADAR`.

Pie chart (single series):

```python
pie_data = CategoryChartData()
pie_data.categories = ["Direct", "Partner", "Online"]
pie_data.add_series("Mix", (0.45, 0.30, 0.25))
gf = slide.shapes.add_chart(XL_CHART_TYPE.PIE, x, y, cx, cy, pie_data)
gf.chart.plots[0].has_data_labels = True
gf.chart.plots[0].data_labels.show_percentage = True
```

### Node

```js
// Bar/column: array of {name, labels, values} series.
slide.addChart(pptx.ChartType.bar, [
  { name: "2025", labels: ["Q1", "Q2", "Q3", "Q4"], values: [1.2, 1.4, 1.6, 1.9] },
  { name: "2026", labels: ["Q1", "Q2", "Q3", "Q4"], values: [1.5, 1.7, 2.0, 2.3] },
], {
  x: 1, y: 1.5, w: 8, h: 4.5,
  barDir: "col",                 // "col" (vertical) | "bar" (horizontal)
  showLegend: true, legendPos: "b",
  showValue: true,
  chartColors: ["1F497D", "4F81BD"],
});

// Line chart.
slide.addChart(pptx.ChartType.line, [
  { name: "MRR", labels: ["Jan", "Feb", "Mar"], values: [10, 12, 15] },
], { x: 1, y: 1.5, w: 8, h: 4, lineSmooth: true, showLegend: true });

// Pie chart (one series; dataLabels as percentages).
slide.addChart(pptx.ChartType.pie, [
  { name: "Mix", labels: ["Direct", "Partner", "Online"], values: [45, 30, 25] },
], { x: 2, y: 1.5, w: 6, h: 4.5, showPercent: true, showLegend: true, legendPos: "r" });
```

`pptx.ChartType` values: `bar`, `bar3d`, `line`, `pie`, `doughnut`, `area`,
`scatter`, `bubble`, `radar`.

---

## 9. Slide masters & templates

### Python — start from a branded `.pptx`

The most reliable path: open the customer's template; its masters, layouts,
theme, fonts, and colors come along. Add slides from its layouts (inspect with
§2), and **delete the example slides** the template ships with.

```python
prs = Presentation("brand.pptx")

# Remove any pre-built example slides so only your content remains.
xml_slides = prs.slides._sldIdLst          # internal but stable across versions
for sldId in list(xml_slides):
    xml_slides.remove(sldId)

slide = prs.slides.add_slide(prs.slide_layouts[1])
slide.shapes.title.text = "Generated on-brand"
prs.save("out.pptx")
```

There is no public high-level "clone slide" API. To duplicate a slide you copy
its XML element; prefer authoring fresh slides from the right layout instead.

### Node — define a reusable master

```js
pptx.defineSlideMaster({
  title: "BRAND",
  background: { color: "FFFFFF" },
  objects: [
    { rect:  { x: 0, y: 7.1, w: "100%", h: 0.4, fill: { color: "1F497D" } } },
    { image: { path: "logo.png", x: 0.3, y: 0.2, w: 1.2, h: 0.5 } },
    { text:  { text: "Confidential", options: { x: 0.3, y: 7.15, w: 6, h: 0.3,
      color: "FFFFFF", fontSize: 9 } } },
    // Named placeholders usable via { placeholder: "title" } (see §3):
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3,
      w: 12, h: 1 }, text: "Click to edit title" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.5, y: 1.5,
      w: 12, h: 5 } } },
  ],
  slideNumber: { x: 12.5, y: 7.15, color: "FFFFFF", fontSize: 9 },
});

const slide = pptx.addSlide({ masterName: "BRAND" });
slide.addText("On brand", { placeholder: "title" });
```

---

## 10. Speaker notes

### Python

```python
notes = slide.notes_slide                  # created lazily on first access
notes.notes_text_frame.text = "Pause here; ask for questions."
```

### Node

```js
slide.addNotes("Pause here; ask for questions.");
```

---

## 11. Save to file vs. in-memory stream

### Python

```python
prs.save("deck.pptx")                      # to disk

import io
stream = io.BytesIO()
prs.save(stream)                           # to a buffer (web response, upload)
stream.seek(0)
data = stream.getvalue()
```

Flask/FastAPI response:

```python
from fastapi import Response
return Response(
    content=data,
    media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
    headers={"Content-Disposition": 'attachment; filename="deck.pptx"'},
)
```

### Node

```js
// To disk (Promise — await it):
await pptx.writeFile({ fileName: "deck.pptx" });

// To a base64 string / Buffer / Blob without touching disk:
const base64 = await pptx.write({ outputType: "base64" });   // "nodebuffer" | "blob" | "arraybuffer"

// Express response:
const buf = await pptx.write({ outputType: "nodebuffer" });
res.setHeader("Content-Type",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation");
res.setHeader("Content-Disposition", 'attachment; filename="deck.pptx"');
res.send(buf);
```

The MIME type for `.pptx` is
`application/vnd.openxmlformats-officedocument.presentationml.presentation`.

---

## 12. Quick verification

After generating, confirm the file is not corrupt:

```python
# Python — reopen and assert structure.
from pptx import Presentation
chk = Presentation("deck.pptx")
assert len(chk.slides) == expected_count
print("slides:", len(chk.slides))
```

```bash
# A valid .pptx is a zip; its content-types part must be present.
unzip -l deck.pptx | grep -q '\[Content_Types\].xml' && echo "looks valid"
```

Or simply open it once in PowerPoint / LibreOffice Impress / Google Slides.

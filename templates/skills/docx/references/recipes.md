# docx recipes — python-docx (MIT) & docx for Node (MIT)

Concrete, copy-pasteable recipes for the `docx` skill. Each section gives a
**Python** (`python-docx`) version and, where the library supports it, a **Node**
(`docx`) version.

Setup, once:

```bash
pip install python-docx        # Python; imports as `docx`
npm install docx               # Node/TS; ESM examples below
```

Reminder of the core difference:

- **python-docx** — open or create a `Document`, mutate it, `doc.save(path)`.
  It can **read and edit** existing files.
- **Node `docx`** — declare the whole document tree, then
  `Packer.toBuffer(doc)` / `Packer.toStream(doc)` and write it yourself. It is
  **write-only** — it cannot open an existing `.docx`.

Common imports used throughout (Python):

```python
from docx import Document
from docx.shared import Pt, Inches, Cm, RGBColor, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.enum.section import WD_SECTION, WD_ORIENT
```

---

## 1. New document — save, stream

### Python

```python
from docx import Document

doc = Document()                      # blank doc using the default template
doc.add_paragraph("Hello, world.")
doc.save("out.docx")                  # write to disk

# Stream to bytes (e.g. an HTTP response body) without touching disk:
import io
buf = io.BytesIO()
doc.save(buf)
data = buf.getvalue()                 # bytes
```

Start from an existing file as a template by passing its path to `Document()`:

```python
doc = Document("template.docx")       # inherits its styles, headers, page setup
```

### Node

```js
import { Document, Packer, Paragraph } from "docx";
import { writeFileSync } from "node:fs";

const doc = new Document({
  sections: [{ children: [new Paragraph("Hello, world.")] }],
});

const buffer = await Packer.toBuffer(doc);   // Uint8Array/Buffer
writeFileSync("out.docx", buffer);
```

Serve directly from an HTTP handler (Express):

```js
app.get("/report.docx", async (_req, res) => {
  const buffer = await Packer.toBuffer(doc);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader("Content-Disposition", 'attachment; filename="report.docx"');
  res.send(buffer);
});
```

---

## 2. Headings, paragraphs, styled runs, paragraph styles

A **paragraph** is a block; a **run** is a contiguous span of identically
formatted text inside it. Character formatting (bold/italic/size/color/font)
lives on the **run**; alignment/spacing/indent live on the **paragraph**.

### Python

```python
doc.add_heading("Document Title", level=0)   # level 0 -> "Title" style
doc.add_heading("Section", level=1)          # 1..9 -> "Heading 1".."Heading 9"

p = doc.add_paragraph()
p.add_run("Normal, ")
p.add_run("bold, ").bold = True
p.add_run("italic, ").italic = True
r = p.add_run("colored 14pt Calibri.")
r.font.size = Pt(14)
r.font.color.rgb = RGBColor(0xC0, 0x00, 0x00)
r.font.name = "Calibri"

# Paragraph-level formatting:
p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
fmt = p.paragraph_format
fmt.space_after = Pt(6)
fmt.line_spacing = 1.5
fmt.left_indent = Inches(0.5)

# Apply a built-in paragraph style by name:
doc.add_paragraph("A quote.", style="Intense Quote")

# Define your own character/paragraph styles:
from docx.enum.style import WD_STYLE_TYPE
styles = doc.styles
body = styles.add_style("BodyMono", WD_STYLE_TYPE.PARAGRAPH)
body.font.name = "Courier New"
body.font.size = Pt(10)
doc.add_paragraph("monospaced body text", style="BodyMono")
```

> Built-in style names (`"Heading 1"`, `"Title"`, `"List Bullet"`, `"Intense
> Quote"`, …) only exist once the document's template defines them. The default
> template includes the common ones; if a name raises `KeyError`, start from a
> `.docx` template that defines it, or add the style yourself.

### Node

```js
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({ text: "Document Title", heading: HeadingLevel.TITLE }),
      new Paragraph({ text: "Section", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 120, line: 360 },          // twips: 120 = 6pt; line 360 = 1.5x of 240
        indent: { left: 720 },                        // 720 twips = 0.5"
        children: [
          new TextRun("Normal, "),
          new TextRun({ text: "bold, ", bold: true }),
          new TextRun({ text: "italic, ", italics: true }),
          new TextRun({ text: "colored 14pt Calibri.", size: 28, color: "C00000", font: "Calibri" }),
          //                                  size is in HALF-points: 28 = 14pt
        ],
      }),
    ],
  }],
});
```

Reusable named styles in Node go in the `styles` option of `new Document({...})`:

```js
const doc = new Document({
  styles: {
    paragraphStyles: [{
      id: "BodyMono",
      name: "Body Mono",
      basedOn: "Normal",
      run: { font: "Courier New", size: 20 },        // 20 half-pts = 10pt
    }],
  },
  sections: [{ children: [new Paragraph({ style: "BodyMono", text: "mono body" })] }],
});
```

> **Units cheat-sheet (Node):** font `size` is **half-points** (14pt → 28).
> Most spacing/indent is **twips** (1pt = 20 twips, 1 inch = 1440 twips).
> Image/page dimensions accept EMUs or use the `convertInchesToTwip` /
> `convertMillimetersToTwip` helpers from `docx`.

---

## 3. Tables

### Python

```python
table = doc.add_table(rows=1, cols=3)
table.style = "Light Grid Accent 1"          # any table style in the template
table.alignment = WD_TABLE_ALIGNMENT.CENTER

hdr = table.rows[0].cells
for i, label in enumerate(["Item", "Qty", "Price"]):
    hdr[i].text = label
    hdr[i].paragraphs[0].runs[0].bold = True

for item, qty, price in [("Widget", "3", "$9.00"), ("Gadget", "1", "$19.00")]:
    cells = table.add_row().cells
    cells[0].text, cells[1].text, cells[2].text = item, qty, price

# Column widths: set on every cell in the column (Word quirk).
from docx.shared import Inches
for row in table.rows:
    row.cells[0].width = Inches(3)
    row.cells[1].width = Inches(1)
    row.cells[2].width = Inches(1.5)

# Merge cells (span): merge returns the merged cell.
a = table.cell(0, 0)
b = table.cell(0, 1)
merged = a.merge(b)
merged.text = "Spanning header"

# Vertical alignment inside a cell:
table.cell(1, 0).vertical_alignment = WD_ALIGN_VERTICAL.CENTER

# Cell background shading needs a tiny XML shim (no high-level API):
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
def shade_cell(cell, hex_fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)             # e.g. "D9E2F3"
    tcPr.append(shd)
shade_cell(table.cell(0, 0), "D9E2F3")
```

### Node

```js
import { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, VerticalAlign, ShadingType } from "docx";

const headerCell = (text) =>
  new TableCell({
    shading: { type: ShadingType.CLEAR, fill: "D9E2F3" },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
  });

const dataRow = (cols) =>
  new TableRow({ children: cols.map((t) => new TableCell({ children: [new Paragraph(t)] })) });

const table = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  columnWidths: [4320, 1440, 2160],            // twips per column
  rows: [
    new TableRow({ children: [headerCell("Item"), headerCell("Qty"), headerCell("Price")] }),
    dataRow(["Widget", "3", "$9.00"]),
    dataRow(["Gadget", "1", "$19.00"]),
  ],
});

// Cell spans: columnSpan / rowSpan on the TableCell, plus verticalAlign:
const spanned = new TableCell({
  columnSpan: 3,
  verticalAlign: VerticalAlign.CENTER,
  children: [new Paragraph("Spanning header")],
});

// add `table` (and any spanned rows) to a section's `children`.
```

---

## 4. Images

### Python

```python
from docx.shared import Inches

# Inline image, sized by width (height scales proportionally):
doc.add_picture("logo.png", width=Inches(2))

# Center it: add_picture appends a new paragraph; align that paragraph.
last = doc.paragraphs[-1]
last.alignment = WD_ALIGN_PARAGRAPH.CENTER

# Image inside a run (so it sits next to text):
p = doc.add_paragraph("Inline icon: ")
run = p.add_run()
run.add_picture("icon.png", width=Inches(0.2))

# From bytes / a stream instead of a path:
import io
with open("logo.png", "rb") as fh:
    doc.add_picture(io.BytesIO(fh.read()), width=Inches(2))
```

> python-docx places pictures **inline** only. True floating/wrapped images
> require raw-XML manipulation and are rarely worth it — prefer inline + a
> centered paragraph, or a single-cell borderless table for positioning.

### Node

```js
import { ImageRun, Paragraph, AlignmentType } from "docx";
import { readFileSync } from "node:fs";

// Inline image inside a (centered) paragraph:
const image = new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [
    new ImageRun({
      data: readFileSync("logo.png"),          // Buffer / Uint8Array / base64
      type: "png",                              // "png" | "jpg" | "gif" | "bmp" | "svg"
      transformation: { width: 200, height: 100 },   // pixels
    }),
  ],
});

// Floating image with text wrap:
import { TextWrappingType, HorizontalPositionAlign, VerticalPositionRelativeFrom } from "docx";
new ImageRun({
  data: readFileSync("logo.png"),
  type: "png",
  transformation: { width: 120, height: 120 },
  floating: {
    horizontalPosition: { align: HorizontalPositionAlign.RIGHT },
    verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: 0 },
    wrap: { type: TextWrappingType.SQUARE },
    allowOverlap: false,
  },
});
```

---

## 5. Headers & footers (with page numbers)

### Python

```python
section = doc.sections[0]

header = section.header
header.is_linked_to_previous = False
header.paragraphs[0].text = "Acme Corp — Confidential"
header.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER

footer = section.footer
fp = footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.CENTER

# Page number as a field code: "Page {PAGE} of {NUMPAGES}".
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
def add_field(paragraph, instr):
    run = paragraph.add_run()
    fldBegin = OxmlElement("w:fldChar"); fldBegin.set(qn("w:fldCharType"), "begin")
    instrText = OxmlElement("w:instrText"); instrText.set(qn("xml:space"), "preserve")
    instrText.text = instr                                   # e.g. " PAGE "
    fldEnd = OxmlElement("w:fldChar"); fldEnd.set(qn("w:fldCharType"), "end")
    run._r.append(fldBegin); run._r.append(instrText); run._r.append(fldEnd)

fp.add_run("Page ")
add_field(fp, " PAGE ")
fp.add_run(" of ")
add_field(fp, " NUMPAGES ")
```

> A different first-page or odd/even header: set
> `section.different_first_page_header_footer = True` then write
> `section.first_page_header` / `section.even_page_header`.

### Node

```js
import { Header, Footer, Paragraph, TextRun, PageNumber, AlignmentType, Document } from "docx";

const doc = new Document({
  sections: [{
    headers: {
      default: new Header({
        children: [new Paragraph({ alignment: AlignmentType.CENTER, text: "Acme Corp — Confidential" })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun("Page "),
            new TextRun({ children: [PageNumber.CURRENT] }),
            new TextRun(" of "),
            new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
          ],
        })],
      }),
    },
    children: [/* body paragraphs */],
  }],
});
```

> Page-number fields display the **field code** until Word computes them on open;
> a value of 0/blank pre-render is expected.

---

## 6. Page setup — size, orientation, margins, breaks

### Python

```python
from docx.shared import Inches
from docx.enum.section import WD_ORIENT

section = doc.sections[0]

# Margins:
section.top_margin = Inches(1)
section.bottom_margin = Inches(1)
section.left_margin = Inches(0.75)
section.right_margin = Inches(0.75)

# Letter portrait -> Landscape (swap width & height when changing orientation):
section.orientation = WD_ORIENT.LANDSCAPE
section.page_width, section.page_height = Inches(11), Inches(8.5)

# A4:
section.page_width, section.page_height = Inches(8.27), Inches(11.69)

# Page break:
from docx.enum.text import WD_BREAK
doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
# or:
doc.add_page_break()

# New section starting on a new page (lets later pages have different setup):
new_sec = doc.add_section(WD_SECTION.NEW_PAGE)
new_sec.orientation = WD_ORIENT.LANDSCAPE
```

### Node

```js
import { Document, Paragraph, PageOrientation, convertInchesToTwip, PageBreak } from "docx";

const doc = new Document({
  sections: [{
    properties: {
      page: {
        size: { orientation: PageOrientation.LANDSCAPE },        // or default = portrait
        margin: {
          top: convertInchesToTwip(1),
          bottom: convertInchesToTwip(1),
          left: convertInchesToTwip(0.75),
          right: convertInchesToTwip(0.75),
        },
      },
    },
    children: [
      new Paragraph("Page one."),
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph("Page two."),
    ],
  }],
});
```

Multiple sections (different page setup) = multiple entries in the `sections`
array; each starts a new section.

---

## 7. Lists — bulleted & numbered

List rendering comes from a **style** or a **numbering definition**, never a
literal `"- "` / `"1. "` prefix.

### Python

```python
# Built-in list styles; pass the style name. Add a trailing digit for nesting
# levels where the template defines them (e.g. "List Bullet 2").
doc.add_paragraph("First bullet", style="List Bullet")
doc.add_paragraph("Second bullet", style="List Bullet")
doc.add_paragraph("Nested bullet", style="List Bullet 2")

doc.add_paragraph("Step one", style="List Number")
doc.add_paragraph("Step two", style="List Number")
```

> The default template defines `List Bullet`/`List Number` (and a few nested
> variants). For fully custom numbering (restart-at, custom glyphs, multilevel)
> you must add a `numbering.xml` definition — uncommon; the built-in styles cover
> almost every real need. If a style name raises `KeyError`, start from a
> template that defines it.

### Node

```js
import { Document, Paragraph, LevelFormat, AlignmentType } from "docx";

const doc = new Document({
  numbering: {
    config: [{
      reference: "my-numbered-list",
      levels: [{
        level: 0,
        format: LevelFormat.DECIMAL,
        text: "%1.",
        alignment: AlignmentType.START,
      }],
    }],
  },
  sections: [{
    children: [
      // Bullets: built-in `bullet` with a level.
      new Paragraph({ text: "First bullet", bullet: { level: 0 } }),
      new Paragraph({ text: "Nested bullet", bullet: { level: 1 } }),
      // Numbers: reference the numbering config defined above.
      new Paragraph({ text: "Step one", numbering: { reference: "my-numbered-list", level: 0 } }),
      new Paragraph({ text: "Step two", numbering: { reference: "my-numbered-list", level: 0 } }),
    ],
  }],
});
```

---

## 8. Find-and-replace (run-safe) — Python only

Word splits a single visible string across several `<w:r>` runs (spell-check,
formatting boundaries, tracked edits). A naive `run.text.replace(...)` therefore
misses matches that straddle run boundaries. Two robust patterns:

**(a) Simple — flatten a paragraph to one run** (loses intra-paragraph
formatting, fine for plain text and placeholder fields):

```python
def replace_in_paragraph(paragraph, old, new):
    if old not in paragraph.text:
        return
    # Concatenate, replace, then collapse to a single run.
    full = paragraph.text.replace(old, new)
    for run in list(paragraph.runs):
        run._r.getparent().remove(run._r)
    paragraph.add_run(full)

def replace_everywhere(doc, old, new):
    for p in doc.paragraphs:
        replace_in_paragraph(p, old, new)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    replace_in_paragraph(p, old, new)
    for section in doc.sections:        # headers/footers too
        for hf in (section.header, section.footer):
            for p in hf.paragraphs:
                replace_in_paragraph(p, old, new)

replace_everywhere(doc, "{{client}}", "Acme Corp")
doc.save("filled.docx")
```

**(b) Formatting-preserving — write the new text into the first matching run**
when the placeholder lives within a single run (the common case for
`{{tokens}}`):

```python
def replace_keep_format(paragraph, old, new):
    for run in paragraph.runs:
        if old in run.text:
            run.text = run.text.replace(old, new)
```

For placeholders that may span runs, design the **template** so each placeholder
is typed in one go (it then occupies a single run) — that makes (b) reliable.

---

## 9. Reading existing documents — Python only

```python
from docx import Document
doc = Document("existing.docx")

# All body paragraph text (skips tables/headers; see below for those).
full_text = "\n".join(p.text for p in doc.paragraphs)

# Headings only, with their level (style name like "Heading 2"):
for p in doc.paragraphs:
    if p.style and p.style.name.startswith("Heading"):
        print(p.style.name, "->", p.text)

# Tables as rows of strings:
for ti, table in enumerate(doc.tables):
    print(f"-- table {ti} --")
    for row in table.rows:
        print([cell.text for cell in row.cells])

# Headers/footers:
for section in doc.sections:
    print("HEADER:", section.header.paragraphs[0].text)
    print("FOOTER:", section.footer.paragraphs[0].text)

# Core document properties (metadata):
cp = doc.core_properties
print(cp.title, cp.author, cp.created, cp.last_modified_by)

# Inline images: count and extract bytes from the package.
from docx.parts.image import ImagePart
for rel in doc.part.rels.values():
    if "image" in rel.reltype:
        blob = rel.target_part.blob       # bytes of the image
        # ...save or inspect blob...
```

> Body order: `doc.paragraphs` and `doc.tables` are **separate** lists; if you
> need the true interleaved order of paragraphs and tables, iterate
> `doc.element.body` children and dispatch on `tag` (`w:p` vs `w:tbl`).

---

## 10. Template-fill pattern (recommended for branded output) — Python

The most reliable way to produce a polished, on-brand `.docx` is to **edit a
human-made template** rather than rebuild its layout in code. The template owns
styles, headers/footers, fonts, and page setup; code only fills values.

```python
from docx import Document

doc = Document("templates/invoice.docx")     # has {{tokens}} typed in by hand

values = {
    "{{client}}": "Acme Corp",
    "{{date}}": "2026-06-01",
    "{{total}}": "$1,240.00",
}

def fill(paragraph, mapping):
    for run in paragraph.runs:
        for token, val in mapping.items():
            if token in run.text:
                run.text = run.text.replace(token, val)

for p in doc.paragraphs:
    fill(p, values)
for t in doc.tables:
    for row in t.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                fill(p, values)

# Append rows to a line-items table (assumes table[0] has a header row):
items = [("Design", "10h", "$1,000"), ("Hosting", "1mo", "$240")]
line_items = doc.tables[0]
for desc, qty, amount in items:
    cells = line_items.add_row().cells
    cells[0].text, cells[1].text, cells[2].text = desc, qty, amount

doc.save("invoice-acme.docx")
```

Tips for templates:

- Type each `{{token}}` in one keystroke run so it lands in a single `<w:r>`
  (makes formatting-preserving replace reliable).
- Keep a header **table** for line items with exactly one header row.
- Do not delete the template's empty trailing section — it carries page setup.

---

## 11. Verifying output (both languages)

Always re-open and assert after writing. python-docx reads any conformant
`.docx`, including files produced by the Node library:

```python
from docx import Document

def verify(path, must_contain=(), min_tables=0):
    d = Document(path)
    text = "\n".join(p.text for p in d.paragraphs)
    for needle in must_contain:
        assert needle in text, f"missing: {needle!r}"
    assert len(d.tables) >= min_tables, f"expected >= {min_tables} tables"
    print(f"OK {path}: {len(d.paragraphs)} paragraphs, {len(d.tables)} tables")

verify("report.docx", must_contain=["Quarterly Report"], min_tables=1)
```

For a Node-generated file, run the same Python check as a smoke test, or in Node
confirm the buffer is a valid ZIP/`.docx` by writing it and re-checking size > 0
and the PK ZIP magic bytes:

```js
import { readFileSync } from "node:fs";
const b = readFileSync("report.docx");
if (!(b[0] === 0x50 && b[1] === 0x4b)) throw new Error("not a valid .docx (no PK header)");
console.log("OK report.docx", b.length, "bytes");
```

---

## License & attribution

This skill and these recipes are **original work**, Apache-2.0, authored from
public documentation of the underlying open-source libraries:

- **python-docx** — MIT License, © Steve Canny and contributors.
- **docx** (Node) — MIT License, © Dolan Miu and contributors.

Both are MIT-licensed; using them imposes no copyleft on output documents.

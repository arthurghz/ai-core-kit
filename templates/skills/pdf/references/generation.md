# PDF generation recipes

Concrete recipes for building PDFs from scratch. Python uses **reportlab**
(BSD); Node uses **pdfkit** (MIT) for flowing-text/table layout and **pdf-lib**
(MIT) where byte-output or precise placement is preferred. All code is authored
from public library knowledge.

Coordinate reminder: PDF units are points (1 pt = 1/72"); origin is bottom-left,
y grows up. pdfkit gives you a top-down text cursor; reportlab's canvas and
pdf-lib are bottom-up.

---

## 1. Text and wrapped paragraphs

### reportlab — raw canvas vs. Platypus flowables

The canvas (`drawString`) places single lines and does **not** wrap. For real
documents use **Platypus** flowables (`Paragraph`, `Spacer`, `Table`, `Image`)
laid out by a `SimpleDocTemplate`, which handles wrapping and page breaks.

```python
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

styles = getSampleStyleSheet()
styles.add(ParagraphStyle("Body", parent=styles["Normal"],
                          fontSize=11, leading=15, alignment=TA_JUSTIFY))

doc = SimpleDocTemplate("report.pdf", pagesize=LETTER,
                        leftMargin=inch, rightMargin=inch,
                        topMargin=inch, bottomMargin=inch)

story = [
    Paragraph("Quarterly Report", styles["Title"]),
    Spacer(1, 12),
    Paragraph("This text wraps automatically inside the frame and flows onto "
              "the next page when it runs out of room. " * 8, styles["Body"]),
]
doc.build(story)   # lays out the story, paginating as needed
```

Inline markup inside a `Paragraph` uses a small HTML-like syntax:
`<b>bold</b>`, `<i>italic</i>`, `<font color="red">…</font>`,
`<a href="https://…">link</a>`, `<br/>`.

### pdfkit — flowing text with a cursor

```js
import PDFDocument from "pdfkit";
import fs from "node:fs";

const doc = new PDFDocument({ size: "LETTER", margins: { top: 72, bottom: 72, left: 72, right: 72 } });
doc.pipe(fs.createWriteStream("report.pdf"));

doc.font("Helvetica-Bold").fontSize(24).text("Quarterly Report");
doc.moveDown();
doc.font("Helvetica").fontSize(11)
   .text("Long body text wraps to the page width and advances the cursor. ".repeat(20), {
     align: "justify",
     indent: 18,
     lineGap: 4,
   });

// Absolute placement (e.g. a sidebar) without moving the flow cursor:
doc.fontSize(9).text("Confidential", 72, 740, { lineBreak: false });

doc.addPage();                       // explicit page break
doc.end();
```

Wait for completion before using the file:

```js
await new Promise((res, rej) => {
  const s = fs.createWriteStream("report.pdf");
  doc.pipe(s);
  /* ...draw... */
  doc.end();
  s.on("finish", res);
  s.on("error", rej);
});
```

---

## 2. Tables

### reportlab — `Table` + `TableStyle`

```python
from reportlab.platypus import Table, TableStyle
from reportlab.lib import colors

data = [
    ["Item", "Qty", "Unit", "Total"],
    ["Widget", "3", "$10.00", "$30.00"],
    ["Gadget", "1", "$25.00", "$25.00"],
    ["", "", "Total", "$55.00"],
]
table = Table(data, colWidths=[220, 50, 80, 80])
table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#222222")),  # header row
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("ALIGN", (1, 0), (-1, -1), "RIGHT"),                         # numeric cols
    ("GRID", (0, 0), (-1, -2), 0.5, colors.grey),
    ("LINEABOVE", (2, -1), (-1, -1), 1, colors.black),            # total rule
    ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f3f3f3")]),
]))
# add `table` to a SimpleDocTemplate story (see §1)
```

Cell coordinates are `(col, row)`; `-1` means last. For tall tables that must
break across pages, use `LongTable` and set `repeatRows=1` to repeat the header.

### pdf-lib — manual grid (no built-in table)

pdf-lib has no table primitive; draw cells as rectangles + text. Helper:

```js
function drawTable(page, font, { x, y, rows, colWidths, rowHeight = 22, size = 11 }) {
  let cy = y;
  for (const row of rows) {
    let cx = x;
    row.forEach((cell, i) => {
      page.drawRectangle({ x: cx, y: cy - rowHeight, width: colWidths[i], height: rowHeight,
                           borderWidth: 0.5, borderColor: rgb(0.6, 0.6, 0.6) });
      page.drawText(String(cell), { x: cx + 4, y: cy - rowHeight + 6, size, font });
      cx += colWidths[i];
    });
    cy -= rowHeight;
  }
}
```

pdfkit also lacks a native table API; either compute columns manually with
`doc.text(..., { width, continued })` or add the small `pdfkit-table` package
(MIT). For anything table-heavy in Python, reportlab is the smoother path.

---

## 3. Images

### reportlab

```python
from reportlab.platypus import Image          # Platypus flowable, scales into the story
logo = Image("logo.png", width=120, height=40)

# or directly on a canvas with explicit placement:
c.drawImage("logo.png", 72, 700, width=120, height=40,
            preserveAspectRatio=True, mask="auto")  # mask="auto" honors transparency
```

### pdfkit

```js
doc.image("logo.png", 72, 72, { width: 120 });        // x, y, fit to width
doc.image("photo.jpg", { fit: [400, 300], align: "center" });  // fit within a box
```

### pdf-lib (embed bytes; PNG/JPEG only)

```js
const png = await pdf.embedPng(fs.readFileSync("logo.png"));
const dims = png.scale(0.5);
page.drawImage(png, { x: 72, y: 700, width: dims.width, height: dims.height });
// JPEG: await pdf.embedJpg(bytes). pdf-lib supports PNG and JPEG natively.
```

---

## 4. Vector graphics

### reportlab canvas

```python
c.setStrokeColor(colors.HexColor("#0066cc"))
c.setLineWidth(2)
c.line(72, 600, 540, 600)                       # horizontal rule
c.setFillColor(colors.HexColor("#e8f0fe"))
c.rect(72, 520, 200, 60, fill=1, stroke=0)      # filled box
c.circle(300, 550, 25, fill=1)
p = c.beginPath()                               # arbitrary polygon
p.moveTo(400, 520); p.lineTo(460, 580); p.lineTo(520, 520); p.close()
c.drawPath(p, fill=1, stroke=1)
```

### pdfkit

```js
doc.save()
   .moveTo(72, 600).lineTo(540, 600).lineWidth(2).strokeColor("#0066cc").stroke();
doc.rect(72, 520, 200, 60).fill("#e8f0fe");
doc.circle(300, 550, 25).fill("#0066cc");
doc.polygon([400, 520], [460, 580], [520, 520]).fillAndStroke("#cccccc", "#333333");
doc.restore();   // save()/restore() isolate style changes
```

### pdf-lib

```js
page.drawLine({ start: { x: 72, y: 600 }, end: { x: 540, y: 600 }, thickness: 2, color: rgb(0, 0.4, 0.8) });
page.drawRectangle({ x: 72, y: 520, width: 200, height: 60, color: rgb(0.91, 0.94, 0.99) });
page.drawCircle({ x: 300, y: 550, size: 25, color: rgb(0, 0.4, 0.8) });
```

---

## 5. Multi-page layout: headers, footers, page numbers

### reportlab — `onPage` callbacks on a page template

`SimpleDocTemplate.build(..., onFirstPage=, onLaterPages=)` runs a function for
every page, giving you a place to stamp a header/footer and page number outside
the flowing story.

```python
def header_footer(canvas, doc):
    canvas.saveState()
    w, h = LETTER
    canvas.setFont("Helvetica", 8)
    canvas.drawString(inch, h - 0.6 * inch, "ACME — Quarterly Report")     # header
    canvas.drawRightString(w - inch, 0.5 * inch, f"Page {doc.page}")       # footer w/ page #
    canvas.line(inch, h - 0.7 * inch, w - inch, h - 0.7 * inch)
    canvas.restoreState()

doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
```

For different first-page vs. body frames (e.g. a cover page), use
`BaseDocTemplate` with multiple `PageTemplate`/`Frame` objects.

### pdfkit — draw on the `pageAdded` event

`doc.page` count isn't final until the end, so the common pattern is to draw the
header/footer as each page is added; the "total pages" value needs the buffered
approach below.

```js
const doc = new PDFDocument({ size: "LETTER", margin: 72, bufferPages: true });
doc.on("pageAdded", () => {
  doc.fontSize(8).text("ACME — Quarterly Report", 72, 40, { lineBreak: false });
});
// ... build content ...

// Stamp "Page X of Y" once the total is known:
const range = doc.bufferedPageRange();          // { start, count }
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  doc.fontSize(8).text(`Page ${i + 1} of ${range.count}`, 72, 750, {
    width: doc.page.width - 144, align: "right",
  });
}
doc.flushPages();
doc.end();
```

### pdf-lib

You control pages directly, so iterate after building and stamp each:

```js
const pages = pdf.getPages();
pages.forEach((page, i) => {
  page.drawText(`Page ${i + 1} of ${pages.length}`, {
    x: page.getWidth() - 120, y: 30, size: 8, font,
  });
});
```

---

## 6. Custom and Unicode fonts

The 14 standard fonts are Latin-only. Embed a TTF/OTF for accents, CJK, etc.

```python
# reportlab
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont("Inter", "Inter-Regular.ttf"))
c.setFont("Inter", 12)
```

```js
// pdfkit — register once, then select by name (or pass the path directly)
doc.registerFont("Inter", "Inter-Regular.ttf");
doc.font("Inter").text("Café — naïve — 日本語");
```

```js
// pdf-lib — requires fontkit for embedding arbitrary fonts
import fontkit from "@pdf-lib/fontkit";
pdf.registerFontkit(fontkit);
const inter = await pdf.embedFont(fs.readFileSync("Inter-Regular.ttf"), { subset: true });
page.drawText("Café — naïve — 日本語", { x: 72, y: 700, size: 12, font: inter });
```

`subset: true` embeds only the glyphs used, keeping file size down — recommended
for large CJK fonts.

---

## 7. Document metadata

```python
# reportlab canvas
c.setTitle("Quarterly Report"); c.setAuthor("ACME"); c.setSubject("Q3 FY26")
```

```js
// pdfkit — via the constructor info object
new PDFDocument({ info: { Title: "Quarterly Report", Author: "ACME" } });
// pdf-lib — setters
pdf.setTitle("Quarterly Report"); pdf.setAuthor("ACME"); pdf.setCreationDate(new Date());
```

---

## Library licenses

- **reportlab** — BSD License (open-source toolkit edition).
- **pdfkit** — MIT License.
- **pdf-lib** / **@pdf-lib/fontkit** — MIT License.
- **Playwright / Puppeteer** (HTML-to-PDF alternative) — Apache-2.0.

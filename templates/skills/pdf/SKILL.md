---
name: pdf
description: >
  Generate and manipulate PDF files from code using permissive open-source
  libraries — reportlab (BSD) in Python and pdf-lib/pdfkit (MIT) in Node for
  GENERATION (text, paragraphs, tables, images, vector drawing, multi-page
  layouts, headers/footers); pypdf (BSD-3-Clause) in Python and pdf-lib (MIT) in
  Node for MANIPULATION (merge, split, rotate, crop, watermark, extract text,
  fill AcroForm fields, encrypt/decrypt, metadata). Use when a task asks to
  create a PDF report/invoice/letter/certificate, combine or split PDFs, stamp a
  watermark, pull text out of a PDF, fill a PDF form, or password-protect a PDF.
  Trigger on "make a PDF", "generate a PDF report/invoice", "merge/split PDFs",
  "add a watermark", "extract text from PDF", "fill this PDF form", or "encrypt
  this PDF". Do NOT use for Word/Excel/PowerPoint authoring (use the docx, xlsx,
  or pptx skills) or for high-fidelity HTML-page-to-PDF rendering where a
  headless browser (Playwright/Puppeteer) is the better fit — see the note below.
license: Apache-2.0
---

# PDF

Create new PDFs and edit existing ones from code, using only permissively
licensed open-source libraries. This skill never reads, copies, or derives from
any proprietary document skill — every recipe here is authored from public
knowledge of the named OSS libraries.

## Pick a library by task and runtime

| Task | Python | Node |
|---|---|---|
| **Generate** (layout text, tables, images, vector) | `reportlab` (BSD) | `pdfkit` (MIT) |
| **Generate** (precise low-level, also edits) | — | `pdf-lib` (MIT) |
| **Manipulate** (merge/split/rotate/watermark/forms/encrypt) | `pypdf` (BSD-3-Clause) | `pdf-lib` (MIT) |
| **Extract text** | `pypdf` (BSD-3-Clause) | `pdf-lib` cannot extract text — use `pdfjs-dist` (Apache-2.0) |

Rule of thumb: **generate from scratch → reportlab / pdfkit; touch an existing
PDF → pypdf / pdf-lib.** In Node, `pdf-lib` does both generation and
manipulation, so a Node-only project can standardize on it (add `pdfkit` only if
you want its higher-level flowing-text and table helpers).

## When NOT to use this skill

- Authoring Word, Excel, or PowerPoint files → use the `docx`, `xlsx`, `pptx`
  skills (export those to PDF afterward if a PDF is the final deliverable).
- Faithfully rendering an existing **HTML/CSS page** (a styled web invoice, a
  dashboard) to PDF → a headless browser is the right tool; see
  [HTML to PDF](#html-to-pdf-alternative) below.
- Pixel-accurate transformation of **scanned/image-only** PDFs or OCR → that is
  an image/OCR pipeline, not this skill.

## Install

```bash
# Python — generation + manipulation
pip install reportlab pypdf

# Node — generation
npm install pdfkit
# Node — generation + manipulation (one library does both); @pdf-lib/fontkit only
# if you embed custom/Unicode fonts
npm install pdf-lib @pdf-lib/fontkit
# Node — text extraction (pdf-lib has none)
npm install pdfjs-dist
```

All four core libraries are pure-library installs with no system/native
dependencies, which makes them safe defaults for CI and serverless. (`pdfkit`
has a small Unicode-font note — see `references/generation.md`.)

## Generate — minimal examples

Python with **reportlab** (low-level canvas; flowables/tables are in the
reference):

```python
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import LETTER

c = canvas.Canvas("hello.pdf", pagesize=LETTER)
width, height = LETTER
c.setFont("Helvetica-Bold", 20)
c.drawString(72, height - 96, "Quarterly Report")     # 72 pt = 1 inch from left
c.setFont("Helvetica", 11)
c.drawString(72, height - 120, "Generated from code with reportlab.")
c.showPage()                                          # finish this page
c.save()                                              # write the file
```

Node with **pdfkit** (flowing text; the stream must finish before the file is
complete):

```js
import PDFDocument from "pdfkit";
import fs from "node:fs";

const doc = new PDFDocument({ size: "LETTER", margin: 72 });
doc.pipe(fs.createWriteStream("hello.pdf"));
doc.font("Helvetica-Bold").fontSize(20).text("Quarterly Report");
doc.moveDown(0.5);
doc.font("Helvetica").fontSize(11).text("Generated from code with pdfkit.");
doc.end();                                            // flush; file is ready on stream "finish"
```

Node with **pdf-lib** (no streams; returns bytes — good for serverless/browser):

```js
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs";

const pdf = await PDFDocument.create();
const page = pdf.addPage([612, 792]);                 // LETTER in points
const font = await pdf.embedFont(StandardFonts.HelveticaBold);
page.drawText("Quarterly Report", { x: 72, y: 696, size: 20, font, color: rgb(0, 0, 0) });
fs.writeFileSync("hello.pdf", await pdf.save());
```

> **Coordinate system:** PDF units are points (1 pt = 1/72 inch) and the origin
> `(0, 0)` is the **bottom-left** corner — y grows upward. pdfkit hides this with
> a top-down text cursor; reportlab and pdf-lib are bottom-up, so subtract from
> the page height to place things from the top.

Full generation recipes — wrapped paragraphs and `Platypus` flowables, tables
with styling, images, vector graphics, and repeating headers/footers via page
templates — are in [`references/generation.md`](references/generation.md).

## Manipulate — minimal examples

Merge two PDFs with **pypdf** (Python):

```python
from pypdf import PdfWriter

writer = PdfWriter()
for path in ("a.pdf", "b.pdf"):
    writer.append(path)                               # appends all pages, preserving content
with open("merged.pdf", "wb") as f:
    writer.write(f)
```

Merge with **pdf-lib** (Node):

```js
import { PDFDocument } from "pdf-lib";
import fs from "node:fs";

const out = await PDFDocument.create();
for (const path of ["a.pdf", "b.pdf"]) {
  const src = await PDFDocument.load(fs.readFileSync(path));
  const pages = await out.copyPages(src, src.getPageIndices());
  pages.forEach((p) => out.addPage(p));               // copyPages, THEN addPage each
}
fs.writeFileSync("merged.pdf", await out.save());
```

Full manipulation recipes — split, rotate/crop, watermark/stamp, extract text,
fill AcroForm fields, encrypt/decrypt, and edit metadata — are in
[`references/manipulation.md`](references/manipulation.md).

## HTML to PDF (alternative)

When the source is **already an HTML/CSS document** and visual fidelity to the
browser matters more than programmatic layout, render it with a headless browser
instead of laying out primitives by hand:

```js
import { chromium } from "playwright";                // Playwright is Apache-2.0
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file:///abs/path/invoice.html", { waitUntil: "networkidle" });
await page.pdf({ path: "invoice.pdf", format: "Letter", printBackground: true });
await browser.close();
```

Puppeteer (Apache-2.0) exposes the same `page.pdf(...)` API. Trade-off: a
browser binary is a heavy dependency (awkward in slim/serverless images) and is
overkill for simple programmatic documents — prefer reportlab/pdfkit/pdf-lib for
those, and reach for a browser only when CSS layout is the spec.

## Gotchas

- **Stream lifecycle (pdfkit):** the file is only complete after the output
  stream emits `finish`; calling `doc.end()` starts the flush, it does not block.
  Wrap in a promise if you must read the file immediately after.
- **Custom/Unicode fonts:** the 14 standard PDF fonts (Helvetica, Times, etc.)
  cover Latin text only. For accents, CJK, or emoji you must embed a TrueType/
  OpenType font — `registerFont`/`font(path)` in pdfkit, `embedFont` with
  `@pdf-lib/fontkit` in pdf-lib, `pdfmetrics.registerFont` in reportlab. See the
  references.
- **`copyPages` before `addPage` (pdf-lib):** pages from another document must be
  copied into the target with `copyPages` before `addPage`; adding a foreign page
  object directly throws.
- **Encryption removal:** to edit an encrypted PDF you must supply the password
  on load; pypdf/pdf-lib will otherwise raise. There is no library bypass for a
  password you do not have — that is by design.
- **Text extraction quality:** extracted text reflects the PDF's internal layout,
  not visual reading order; tables and multi-column layouts can come out
  scrambled. For image-only/scanned PDFs there is no text to extract — use OCR.

## Related skills

- `docx`, `xlsx`, `pptx` — author Office documents (export to PDF if needed).
- `coding-standards` — the baseline conventions generated tooling is held to.

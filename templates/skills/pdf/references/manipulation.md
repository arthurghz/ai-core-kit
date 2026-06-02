# PDF manipulation recipes

Concrete recipes for editing existing PDFs. Python uses **pypdf**
(BSD-3-Clause); Node uses **pdf-lib** (MIT). Text extraction in Node uses
**pdfjs-dist** (Apache-2.0) because pdf-lib has no extraction. All code is
authored from public library knowledge.

> `pypdf` is the maintained successor to the old `PyPDF2`; the import is
> `from pypdf import ...`. If you only have `PyPDF2`, the same APIs largely apply,
> but prefer `pip install pypdf`.

---

## 1. Merge

### pypdf

```python
from pypdf import PdfWriter

writer = PdfWriter()
writer.append("a.pdf")                 # all pages
writer.append("b.pdf", pages=(0, 3))   # only pages 0,1,2 (a (start, stop) slice)
with open("merged.pdf", "wb") as f:
    writer.write(f)
writer.close()
```

### pdf-lib

```js
import { PDFDocument } from "pdf-lib";
import fs from "node:fs";

const out = await PDFDocument.create();
for (const path of ["a.pdf", "b.pdf"]) {
  const src = await PDFDocument.load(fs.readFileSync(path));
  const copied = await out.copyPages(src, src.getPageIndices());  // copy FIRST
  copied.forEach((p) => out.addPage(p));                          // THEN add
}
fs.writeFileSync("merged.pdf", await out.save());
```

---

## 2. Split / extract a page range

### pypdf

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("input.pdf")
# pages 2–4 (0-indexed 1..3) into their own file
writer = PdfWriter()
for i in range(1, 4):
    writer.add_page(reader.pages[i])
with open("pages_2_4.pdf", "wb") as f:
    writer.write(f)

# burst: one file per page
for i, page in enumerate(reader.pages):
    w = PdfWriter()
    w.add_page(page)
    with open(f"page_{i + 1}.pdf", "wb") as f:
        w.write(f)
```

### pdf-lib

```js
const src = await PDFDocument.load(fs.readFileSync("input.pdf"));
const out = await PDFDocument.create();
const copied = await out.copyPages(src, [1, 2, 3]);   // 0-indexed
copied.forEach((p) => out.addPage(p));
fs.writeFileSync("pages_2_4.pdf", await out.save());
```

---

## 3. Rotate and crop

### pypdf

```python
reader = PdfReader("input.pdf")
writer = PdfWriter()
for page in reader.pages:
    page.rotate(90)                    # clockwise; multiples of 90 (cumulative)
    # crop by moving the visible box (units are points, bottom-left origin):
    page.cropbox.lower_left = (36, 36)
    page.cropbox.upper_right = (576, 756)
    writer.add_page(page)
with open("rotated.pdf", "wb") as f:
    writer.write(f)
```

### pdf-lib

```js
import { degrees } from "pdf-lib";
const pdf = await PDFDocument.load(fs.readFileSync("input.pdf"));
for (const page of pdf.getPages()) {
  page.setRotation(degrees(90));
  // crop box (x, y, width, height):
  page.setCropBox(36, 36, 540, 720);
}
fs.writeFileSync("rotated.pdf", await pdf.save());
```

---

## 4. Watermark / stamp

A watermark is an overlay of one PDF (or text) onto every page of another.

### pypdf — overlay a stamp PDF

```python
from pypdf import PdfReader, PdfWriter

stamp = PdfReader("watermark.pdf").pages[0]   # a one-page PDF holding the mark
reader = PdfReader("input.pdf")
writer = PdfWriter()
for page in reader.pages:
    page.merge_page(stamp, over=True)         # over=True = stamp on top; False = under
    writer.add_page(page)
with open("watermarked.pdf", "wb") as f:
    writer.write(f)
```

Generate the `watermark.pdf` with reportlab (a faint diagonal "DRAFT"):

```python
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import LETTER
from reportlab.lib import colors

c = canvas.Canvas("watermark.pdf", pagesize=LETTER)
c.setFont("Helvetica-Bold", 72)
c.setFillColor(colors.Color(0.5, 0.5, 0.5, alpha=0.25))   # 25% opacity grey
c.saveState(); c.translate(306, 396); c.rotate(45)
c.drawCentredString(0, 0, "DRAFT")
c.restoreState(); c.save()
```

### pdf-lib — draw text directly on each page

```js
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
const pdf = await PDFDocument.load(fs.readFileSync("input.pdf"));
const font = await pdf.embedFont(StandardFonts.HelveticaBold);
for (const page of pdf.getPages()) {
  const { width, height } = page.getSize();
  page.drawText("DRAFT", {
    x: width / 2 - 120, y: height / 2, size: 72, font,
    color: rgb(0.5, 0.5, 0.5), opacity: 0.25, rotate: degrees(45),
  });
}
fs.writeFileSync("watermarked.pdf", await pdf.save());
```

---

## 5. Extract text

### pypdf

```python
from pypdf import PdfReader

reader = PdfReader("input.pdf")
all_text = "\n".join(page.extract_text() or "" for page in reader.pages)
page1 = reader.pages[0].extract_text()
```

`extract_text()` follows the PDF's internal content order, which may not match
visual reading order (multi-column/table layouts can scramble). For scanned
image-only PDFs there is no embedded text — `extract_text()` returns empty and
you need OCR (e.g. `pytesseract` over rasterized pages) instead.

### Node — pdfjs-dist (pdf-lib cannot extract text)

```js
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";

const data = new Uint8Array(fs.readFileSync("input.pdf"));
const doc = await pdfjs.getDocument({ data }).promise;
let text = "";
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const content = await page.getTextContent();
  text += content.items.map((it) => it.str).join(" ") + "\n";
}
```

---

## 6. Fill AcroForm fields

Works for interactive (AcroForm) fields. Flattening bakes values in so they are
no longer editable.

### pypdf

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("form.pdf")
writer = PdfWriter()
writer.append(reader)
writer.update_page_form_field_values(
    writer.pages[0],
    {"full_name": "Ada Lovelace", "subscribe": "/Yes"},  # checkbox = its export value, e.g. /Yes
    auto_regenerate=False,                                # avoid needing the field's /DA appearance
)
# Optional: flatten so fields are no longer editable:
# from pypdf.generic import NameObject
# (or write, then re-open and flatten via your viewer / NeedAppearances)
with open("filled.pdf", "wb") as f:
    writer.write(f)
```

Inspect available fields first: `reader.get_fields()` returns a dict of field
names to metadata (type, current value, options for choices/checkboxes).

### pdf-lib

```js
const pdf = await PDFDocument.load(fs.readFileSync("form.pdf"));
const form = pdf.getForm();
form.getTextField("full_name").setText("Ada Lovelace");
form.getCheckBox("subscribe").check();
form.getDropdown("country").select("US");
// form.flatten();                       // make values permanent / non-editable
fs.writeFileSync("filled.pdf", await pdf.save());

// Discover fields: form.getFields().forEach(f => console.log(f.getName(), f.constructor.name));
```

---

## 7. Encrypt / decrypt

### pypdf

```python
from pypdf import PdfReader, PdfWriter

# Encrypt:
writer = PdfWriter()
writer.append("input.pdf")
writer.encrypt(user_password="open-me", owner_password="owner-secret",
               algorithm="AES-256")        # AES-256 is the strong modern choice
with open("encrypted.pdf", "wb") as f:
    writer.write(f)

# Open an encrypted file (you MUST know the password):
reader = PdfReader("encrypted.pdf")
if reader.is_encrypted:
    reader.decrypt("open-me")
text = reader.pages[0].extract_text()
```

### pdf-lib

pdf-lib does **not** write encrypted PDFs. It *can* open a password-protected
file if you pass the password, but to (re)encrypt output you need pypdf
(Python), `qpdf` as an external tool, or another library. To open:

```js
const pdf = await PDFDocument.load(bytes, { password: "open-me" });  // recent pdf-lib forks
```

There is no way to remove a password you do not know — that is by design.

---

## 8. Edit metadata

### pypdf

```python
reader = PdfReader("input.pdf")
writer = PdfWriter()
writer.append(reader)
writer.add_metadata({"/Title": "Final Report", "/Author": "ACME",
                     "/Subject": "Q3 FY26", "/Keywords": "report,finance"})
with open("tagged.pdf", "wb") as f:
    writer.write(f)
# Read existing: reader.metadata.title, reader.metadata.author, ...
```

### pdf-lib

```js
const pdf = await PDFDocument.load(fs.readFileSync("input.pdf"));
pdf.setTitle("Final Report");
pdf.setAuthor("ACME");
pdf.setKeywords(["report", "finance"]);
pdf.setModificationDate(new Date());
fs.writeFileSync("tagged.pdf", await pdf.save());
```

---

## Common pitfalls

- **`copyPages` before `addPage` (pdf-lib):** adding a page object from another
  document without copying it first throws. Always copy into the target.
- **0- vs 1-indexed pages:** both libraries are 0-indexed in code; users think
  1-indexed. Translate at the boundary (page "1" → index `0`).
- **Rotation is cumulative (pypdf `rotate`)** but absolute in pdf-lib
  (`setRotation`). Don't double-rotate.
- **Form values not visible:** some viewers need the appearance regenerated; set
  the form's `NeedAppearances` flag, or flatten the form to bake values in.
- **Encrypted input:** decrypt/load with the password before any read or edit, or
  the call raises.
- **Linearization / huge files:** these libraries load the whole document; for
  very large PDFs watch memory, and consider `qpdf` for streaming-style ops.

## Library licenses

- **pypdf** — BSD-3-Clause License.
- **pdf-lib** — MIT License.
- **pdfjs-dist** (text extraction) — Apache-2.0 License.
- **reportlab** (to build a stamp/watermark page) — BSD License.

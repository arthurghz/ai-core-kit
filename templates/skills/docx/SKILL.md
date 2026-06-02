---
name: docx
description: >
  Creates and edits Microsoft Word .docx documents programmatically — new
  documents, headings/paragraphs/styled runs, tables, inline images,
  headers/footers, page setup, bulleted/numbered lists, find-and-replace, and
  reading text out of existing .docx files. Built on the open-source python-docx
  (MIT, Python) and docx (MIT, Node/JS) libraries. Use when the user asks to
  "create/generate a Word document", "write a .docx", "build a report/letter/
  contract as a Word file", "fill in a Word template", "add a table/image/header
  to a docx", "convert this content to Word", or "read/extract text from a
  .docx". Do NOT use for PDF output (use the pdf skill), spreadsheets (xlsx
  skill), slide decks (pptx skill), Google Docs via the Drive API, or for
  high-fidelity editing of an existing document's complex layout that python-docx
  cannot round-trip (warn the user and prefer a template-fill approach instead).
license: Apache-2.0
---

# docx — create & edit Word documents

Generate and modify Microsoft Word `.docx` files in code. This skill is built on
two **MIT-licensed** open-source libraries:

- **Python** — [`python-docx`](https://python-docx.readthedocs.io/) (MIT).
- **Node / JavaScript** — [`docx`](https://docx.js.org/) (MIT).

A `.docx` is a ZIP of XML parts (Office Open XML / ECMA-376). Both libraries
build that XML for you, so you almost never touch raw XML.

## When to use

- "Create / generate a Word document", "write a `.docx`".
- "Build a report / letter / contract / invoice as a Word file."
- "Fill in this Word template with these values."
- "Add a table / image / header / footer / page break to a docx."
- "Turn this Markdown / text / data into a Word document."
- "Read / extract the text (or tables) from this `.docx`."

## When NOT to use

- **PDF** output → use the `pdf` skill (you can author a `.docx` then convert,
  but if the deliverable is a PDF, start there).
- **Spreadsheets** (`.xlsx`) → `xlsx` skill. **Slides** (`.pptx`) → `pptx` skill.
- **Google Docs** → use the Drive/Docs API, not this skill.
- **High-fidelity round-trip edits** of a document with complex layout
  (text boxes, tracked changes, SmartArt, equations): python-docx silently drops
  parts it does not model. Warn the user; prefer editing a **template** whose
  structure you control, or do targeted run-level find-replace only.

## Choosing a language

Both libraries cover the common cases. Pick by the surrounding project:

| Need | Prefer |
|---|---|
| **Reading / extracting** text or tables from an existing `.docx` | **Python** — `python-docx` reads; the Node `docx` library is **write-only**. |
| Editing an existing document in place | **Python** (Node `docx` cannot open existing files). |
| Generating a new doc inside a Node/TypeScript service | **Node** (`docx`). |
| Generating a new doc inside a Python service / data script | **Python** (`python-docx`). |

> **Key constraint:** the Node `docx` library only **creates** documents — it
> cannot open or read an existing `.docx`. For any read-or-edit task, use Python.

## Install

```bash
pip install python-docx        # Python  (imports as `docx`)
npm install docx               # Node / JavaScript / TypeScript
```

python-docx imports as `docx` (the package is *python-docx* on PyPI, the module
is `docx`). Do not also `pip install docx` — that is an unrelated, broken
package and will shadow the import.

## Minimal end-to-end example — Python

```python
from docx import Document
from docx.shared import Pt, Inches

doc = Document()                                  # new blank document
doc.add_heading("Quarterly Report", level=0)      # level 0 = title
doc.add_heading("Summary", level=1)

p = doc.add_paragraph("Revenue grew ")
p.add_run("23%").bold = True                       # styled run inside a paragraph
p.add_run(" quarter over quarter.")

# A small table with a header row.
table = doc.add_table(rows=1, cols=2)
table.style = "Light Grid Accent 1"
hdr = table.rows[0].cells
hdr[0].text, hdr[1].text = "Metric", "Value"
for metric, value in [("Revenue", "$1.2M"), ("Users", "8,400")]:
    row = table.add_row().cells
    row[0].text, row[1].text = metric, value

doc.save("report.docx")
```

## Minimal end-to-end example — Node

```js
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { writeFileSync } from "node:fs";

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({ text: "Quarterly Report", heading: HeadingLevel.TITLE }),
      new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        children: [
          new TextRun("Revenue grew "),
          new TextRun({ text: "23%", bold: true }),
          new TextRun(" quarter over quarter."),
        ],
      }),
    ],
  }],
});

// docx builds the file in memory; you write the buffer yourself.
const buffer = await Packer.toBuffer(doc);
writeFileSync("report.docx", buffer);
```

Note the two different shapes: python-docx **mutates a `Document` and saves it**;
Node `docx` **declares the whole tree, then a `Packer` serializes it to a
buffer** you write to disk (or stream as an HTTP response).

## Workflow

1. **Pick the language** (table above) — reading/editing ⇒ Python.
2. **Confirm the deliverable is really `.docx`** (not PDF/Google Docs).
3. **For template-fill**, get the template path and the field→value map; prefer
   editing a known template over rebuilding complex layout from scratch.
4. **Build / edit** using the recipes in `references/recipes.md`.
5. **Save** to a path the user can find; report the absolute path.
6. **Verify**: re-open with python-docx and assert key content exists
   (see "Verifying output" in the recipes). Never claim success unseen.

## Recipes

All concrete, copy-pasteable code lives in **`references/recipes.md`**, with a
Python and a Node version of each where the Node library supports it:

| Recipe | Python | Node |
|---|---|---|
| New document, save / stream | ✅ | ✅ |
| Headings, paragraphs, styled runs, paragraph styles | ✅ | ✅ |
| Tables (headers, spans, widths, styling) | ✅ | ✅ |
| Inline & floating images | ✅ | ✅ |
| Headers & footers (incl. page numbers) | ✅ | ✅ |
| Page setup (size, orientation, margins, breaks) | ✅ | ✅ |
| Bulleted & numbered lists | ✅ | ✅ |
| Find-and-replace (run-safe) | ✅ (read+edit) | n/a (write-only) |
| Reading existing docs (text, tables, properties) | ✅ | n/a (write-only) |
| Template-fill pattern | ✅ | — |
| Verifying output | ✅ | ✅ (via Python) |

## Common pitfalls

| Pitfall | Fix |
|---|---|
| `pip install docx` instead of `python-docx` | Uninstall `docx`; install **`python-docx`** (it still imports as `docx`). |
| Expecting Node `docx` to open/read a file | It is **write-only**. Use python-docx to read or edit. |
| Naive find-replace misses text | Word splits text across multiple `<w:r>` runs; replace at run level or rebuild the paragraph — see the run-safe recipe. |
| Bullets/numbers don't render | List formatting comes from a **style** (`List Bullet` / `List Number`) or a numbering definition, not a literal "- " prefix. |
| `add_picture` errors on width | Use `docx.shared.Inches(...)` / `Cm(...)`, not a bare number. |
| Styles like `"Heading 1"` raise `KeyError` | The style must exist in the document's template; built-ins appear once first used, or start from a `.docx` template that defines them. |
| Page numbers show as `0` or blank | They are field codes Word computes on open — that is expected; they render correctly in Word. |
| Overwriting the user's source file when editing | Save edits to a new path unless the user asked to overwrite. |

## Verifying output (always do this)

After writing, re-open with python-docx and assert the content is present —
catches empty/corrupt files and missing data before you report done:

```python
from docx import Document
d = Document("report.docx")
text = "\n".join(p.text for p in d.paragraphs)
assert "Quarterly Report" in text, "title missing"
assert d.tables, "expected at least one table"
print("OK:", len(d.paragraphs), "paragraphs,", len(d.tables), "tables")
```

This works even for files generated by the Node library, since python-docx reads
any conformant `.docx`.

## Cross-references

- `pdf` — when the deliverable is a PDF.
- `xlsx` — spreadsheets. `pptx` — slide decks.

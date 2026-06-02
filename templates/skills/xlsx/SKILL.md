---
name: xlsx
description: >
  Creates and edits Excel .xlsx spreadsheets programmatically with the
  MIT-licensed open-source libraries openpyxl (Python) and exceljs (Node) —
  workbooks and sheets, typed cell values, formulas, number/date formats, styles
  (fonts, fills, borders, alignment), column widths and freeze panes, data
  validation dropdowns, native charts, reading existing files, and streaming
  very large workbooks. Use when the user wants to generate a spreadsheet,
  build an .xlsx report or export, write tabular data to Excel, add formulas or
  charts or conditional formatting to a sheet, read/parse an existing workbook,
  or convert data into an Excel file. Trigger on "make an Excel file", "export
  to xlsx", "generate a spreadsheet", "create a report in Excel", "add a chart
  to this sheet", "read this .xlsx", or "openpyxl"/"exceljs". Do NOT use for
  Word documents (use docx), PowerPoint decks (use pptx), PDFs (use pdf), or
  plain CSV with no formatting/formulas/multiple sheets (write CSV directly).
license: Apache-2.0
---

# xlsx — create & edit Excel spreadsheets

Generate and edit `.xlsx` workbooks from data, with formulas, formatting, charts,
data validation, and streaming for large files. Built on two MIT-licensed,
pure-language libraries — no Excel, LibreOffice, or COM automation required:

- **openpyxl** (Python) — reads & writes `.xlsx`/`.xlsm`; charts, styles,
  validation, and read-only/write-only streaming modes.
- **exceljs** (Node) — reads & writes `.xlsx` and CSV; styles, formulas,
  validation, images, and a streaming reader/writer.

Concrete, copy-pasteable recipes for every task below live in
[`references/recipes.md`](references/recipes.md). Read that file before writing
generation code — this page is the map; the recipes are the territory.

## When to use

- Generate a spreadsheet or `.xlsx` report/export from data.
- Write tabular data into one or more sheets, with types preserved.
- Add formulas, number/date formats, styles, charts, conditional formatting,
  or dropdown validation to a workbook.
- Read or parse an existing `.xlsx` (including Excel's cached formula results).
- Produce a workbook too large to hold in memory (streaming).

## When NOT to use

- Word documents → use `docx`. PowerPoint → use `pptx`. PDF → use `pdf`.
- Plain comma-separated data with **no** formatting, formulas, or multiple
  sheets → write a `.csv` directly; an `.xlsx` adds nothing.
- Pivot tables, macros (VBA), or live external-data connections → out of scope
  for these libraries; say so rather than faking it.

## Pick the engine

| Use | Engine |
|---|---|
| Project is Python, or you need **native editable charts** | openpyxl |
| Project is Node/TypeScript | exceljs |
| Read Excel's **cached computed** formula values | openpyxl `data_only=True` |
| Embed a pre-rendered chart **image** in a Node project | exceljs `addImage` |

Match the project's existing language first. Charts are the one real capability
gap: exceljs cannot create native chart objects (only embed images), so reach
for openpyxl when the deliverable needs editable charts.

## Install

```bash
# Python
pip install openpyxl          # MIT

# Node
npm install exceljs           # MIT
```

Both are pure-language with no system dependencies. Pin a version in the
project manifest (`requirements.txt` / `package.json`) when generating a repo.

## The one constraint to state up front

**Neither library evaluates formulas.** They store the formula *string*; Excel
computes the result when the file is opened. Consequences:

- A workbook written purely by these libraries has **no cached values** — a
  non-Excel reader (or `data_only=True`) sees `None`/empty for formula cells.
- If a value must be visible without opening in Excel, either **cache the
  result** (exceljs `{ formula, result }`) or **compute and write the value
  yourself**.

Tell the user this before promising a "calculated" spreadsheet.

## Minimal example — Python (openpyxl)

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

wb = Workbook()
ws = wb.active
ws.title = "Sales"

ws.append(["Month", "Units", "Price", "Total"])      # header row
for cell in ws[1]:                                   # style the header
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = PatternFill("solid", fgColor="4472C4")

rows = [("Jan", 120, 9.99), ("Feb", 150, 9.99), ("Mar", 98, 9.99)]
for r, (month, units, price) in enumerate(rows, start=2):
    ws.cell(row=r, column=1, value=month)
    ws.cell(row=r, column=2, value=units)
    ws.cell(row=r, column=3, value=price).number_format = '"$"#,##0.00'
    ws.cell(row=r, column=4, value=f"=B{r}*C{r}").number_format = '"$"#,##0.00'

ws["B5"] = "=SUM(B2:B4)"
ws.column_dimensions["A"].width = 12
ws.freeze_panes = "A2"
wb.save("sales.xlsx")
```

## Minimal example — Node (exceljs)

```js
const ExcelJS = require('exceljs');

async function main() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sales', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    { header: 'Month', key: 'month', width: 12 },
    { header: 'Units', key: 'units', width: 10 },
    { header: 'Price', key: 'price', width: 10, style: { numFmt: '"$"#,##0.00' } },
    { header: 'Total', key: 'total', width: 12, style: { numFmt: '"$"#,##0.00' } },
  ];
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  });

  [['Jan', 120, 9.99], ['Feb', 150, 9.99], ['Mar', 98, 9.99]].forEach((r, i) => {
    const row = ws.addRow({ month: r[0], units: r[1], price: r[2] });
    row.getCell('total').value = { formula: `B${i + 2}*C${i + 2}`, result: r[1] * r[2] };
  });
  ws.getCell('B5').value = { formula: 'SUM(B2:B4)' };

  await wb.xlsx.writeFile('sales.xlsx');
}
main();
```

## Recipe index

Every task maps to a section of [`references/recipes.md`](references/recipes.md):

| Task | Recipe section |
|---|---|
| Create/open workbooks, add/copy/reorder/remove sheets | Workbooks & sheets |
| Write cells by A1 or (row, col); typed values; append rows; rich text; links | Writing cells & data types |
| Store formulas; shared/array formulas; cache a result | Formulas |
| Currency, percent, thousands, date/time format codes | Number & date formats |
| Fonts, fills, borders, alignment, wrap, named styles | Styles |
| Column width, row height, hide, freeze panes, pseudo auto-fit | Column widths, row heights, freeze panes |
| Merge cells, auto-filter, color-scale & cellIs rules | Merged cells, auto-filter, conditional formatting |
| Dropdown lists, range-sourced lists, numeric bounds | Data validation |
| Bar/line/pie charts (openpyxl); image charts (exceljs) | Charts |
| Read cells, iterate rows/cols, cached values | Reading workbooks |
| Write-only & read-only (Python); streaming writer/reader (Node) | Streaming large files |
| Common mistakes and their fixes | Gotchas |

## Workflow

1. **Clarify the deliverable** — sheets, columns, data source, and whether any
   cell must show a *computed* value (see the formula constraint above).
2. **Pick the engine** from the table — match the project language; choose
   openpyxl when native charts are required.
3. **Install & pin** the library in the project manifest.
4. **Build incrementally** — headers and data first, then formats, then styles,
   formulas, validation, and charts last. Pull each piece from
   `references/recipes.md`.
5. **For big data** (tens of thousands of rows or more) switch to the streaming
   recipe instead of building the whole workbook in memory.
6. **Verify** — open or re-read the saved file and confirm sheet names, the used
   range, types, and that formula cells carry the intended formula/result.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Promising "calculated" cells from a library-only workbook | Cache the result (exceljs) or compute the value yourself; state the constraint. |
| Faking native charts in exceljs | Use openpyxl for editable charts, or embed a rendered image and say so. |
| Colors with a leading `#` | openpyxl: `"RRGGBB"`; exceljs: `{ argb: 'FFRRGGBB' }` (alpha first). |
| Building a million-row workbook in memory | Use the streaming writer/reader recipe. |
| Mutating one openpyxl style object across many cells | Styles are immutable — make per-cell styles or a `NamedStyle`. |
| Emitting an `.xlsx` for plain unformatted tabular data | Write a `.csv` instead. |
| Dates rendering as serial numbers | Set a date `number_format` / `numFmt`. |

## Reference files

| File | Content |
|---|---|
| [`references/recipes.md`](references/recipes.md) | Full Python (openpyxl) + Node (exceljs) recipes for every task above, with a gotchas table. |

## Cross-references

- `docx` — Word documents. `pptx` — PowerPoint decks. `pdf` — PDF generation.

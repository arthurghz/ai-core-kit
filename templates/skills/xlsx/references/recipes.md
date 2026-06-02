# xlsx recipes — openpyxl (Python) & exceljs (Node)

Concrete, copy-pasteable recipes for creating and editing `.xlsx` workbooks.
Two engines, both MIT-licensed:

- **openpyxl** (Python) — `pip install openpyxl`. Pure-Python, reads & writes
  `.xlsx`/`.xlsm`. No Excel/LibreOffice required. Charts, styles, validation,
  read-only & write-only streaming modes.
- **exceljs** (Node) — `npm install exceljs`. Reads & writes `.xlsx` and CSV.
  Styles, formulas, data validation, images, streaming reader/writer.

Neither library evaluates formulas — they store the formula string and Excel
computes the value on open. To read *computed* values written by Excel, see
[Reading workbooks](#reading-workbooks) (`data_only=True`).

Contents:

1. [Workbooks & sheets](#workbooks--sheets)
2. [Writing cells & data types](#writing-cells--data-types)
3. [Formulas](#formulas)
4. [Number & date formats](#number--date-formats)
5. [Styles: fonts, fills, borders, alignment](#styles-fonts-fills-borders-alignment)
6. [Column widths, row heights, freeze panes](#column-widths-row-heights-freeze-panes)
7. [Merged cells, auto-filter, conditional formatting](#merged-cells-auto-filter-conditional-formatting)
8. [Data validation (dropdowns)](#data-validation-dropdowns)
9. [Charts](#charts)
10. [Reading workbooks](#reading-workbooks)
11. [Streaming large files](#streaming-large-files)
12. [Gotchas](#gotchas)

---

## Workbooks & sheets

### Python (openpyxl)

```python
from openpyxl import Workbook, load_workbook

# New workbook — comes with one sheet already.
wb = Workbook()
ws = wb.active                 # the default sheet
ws.title = "Summary"

# Add more sheets.
data = wb.create_sheet("Data")            # appended at the end
first = wb.create_sheet("Cover", 0)        # inserted at index 0
copy = wb.copy_worksheet(ws)               # duplicate within the same workbook

# Look up, list, reorder, remove.
ws = wb["Data"]
names = wb.sheetnames                      # ['Cover', 'Summary', 'Data']
wb.move_sheet("Data", -1)                  # shift left by 1
del wb["Cover"]                            # or wb.remove(wb["Cover"])

wb.save("report.xlsx")

# Open an existing file (defaults to writable, formulas as strings).
wb = load_workbook("report.xlsx")
```

### Node (exceljs)

```js
const ExcelJS = require('exceljs');

async function build() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ai-core-kit';
  wb.created = new Date();

  const summary = wb.addWorksheet('Summary');
  const data = wb.addWorksheet('Data', {
    properties: { tabColor: { argb: 'FF00B050' } },
    views: [{ state: 'frozen', ySplit: 1 }], // freeze the header row
  });

  wb.getWorksheet('Summary');           // by name
  wb.worksheets.map((w) => w.name);     // list
  wb.removeWorksheet(data.id);          // remove by id

  await wb.xlsx.writeFile('report.xlsx');
}
build();
```

Open an existing file in Node:

```js
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile('report.xlsx');
// or from a stream / buffer:
await wb.xlsx.read(readableStream);
await wb.xlsx.load(buffer);
```

---

## Writing cells & data types

Cells accept native types. The library maps Python/JS types to Excel cell types:
numbers → numeric, `str` → text, `bool` → boolean, `datetime`/`Date` → a number
with a date format, `None`/`null` → empty.

### Python

```python
# By A1 reference.
ws["A1"] = "Name"          # text
ws["B1"] = 42              # int
ws["C1"] = 3.14159         # float
ws["D1"] = True            # boolean

# By (row, col) — 1-based — useful in loops.
ws.cell(row=2, column=1, value="Ada")
c = ws.cell(row=2, column=2)
c.value = 100

import datetime
ws["E1"] = datetime.date(2026, 6, 1)        # date
ws["E2"] = datetime.datetime(2026, 6, 1, 9, 30)  # datetime

# Append whole rows (fast path for tabular data).
ws.append(["col1", "col2", "col3"])         # next empty row
for row in [[1, 2, 3], [4, 5, 6]]:
    ws.append(row)

# Write a 2-D block at an anchor.
rows = [["Q1", 120], ["Q2", 150]]
for r, row in enumerate(rows, start=5):
    for col, val in enumerate(row, start=1):
        ws.cell(row=r, column=col, value=val)
```

Column letter <-> index helpers:

```python
from openpyxl.utils import get_column_letter, column_index_from_string
get_column_letter(28)            # 'AB'
column_index_from_string("AB")   # 28
```

### Node

```js
const ws = wb.addWorksheet('Data');

// By A1 reference.
ws.getCell('A1').value = 'Name';
ws.getCell('B1').value = 42;
ws.getCell('C1').value = 3.14159;
ws.getCell('D1').value = true;
ws.getCell('E1').value = new Date(2026, 5, 1); // month is 0-based in JS

// By (row, col) — both 1-based.
ws.getRow(2).getCell(1).value = 'Ada';
ws.getCell(2, 2).value = 100;

// Add rows — array form follows column order.
ws.addRow(['col1', 'col2', 'col3']);
ws.addRows([[1, 2, 3], [4, 5, 6]]);

// Add rows by key (after defining columns, see below).
ws.columns = [
  { header: 'Name', key: 'name', width: 20 },
  { header: 'Score', key: 'score', width: 10 },
];
ws.addRow({ name: 'Ada', score: 100 });

// Rich text in one cell.
ws.getCell('A10').value = {
  richText: [
    { text: 'Bold ', font: { bold: true } },
    { text: 'and normal', font: { bold: false } },
  ],
};

// Hyperlink.
ws.getCell('A11').value = {
  text: 'docs', hyperlink: 'https://example.com',
};
```

---

## Formulas

Both libraries store the formula **string**; Excel computes it on open. Do not
prefix with `=` in exceljs's `formula` field, but openpyxl expects the leading
`=`.

### Python

```python
ws["B10"] = "=SUM(B2:B9)"
ws["C10"] = "=AVERAGE(C2:C9)"
ws["D2"] = "=B2*C2"
ws["E1"] = '=IF(D2>100,"high","low")'

# Shared/array formula across a range (openpyxl >= 3.1).
from openpyxl.worksheet.formula import ArrayFormula
ws["F2"] = ArrayFormula("F2:F9", "=B2:B9*C2:C9")
```

To pre-compute a value so a non-Excel reader sees it, you must set the value
yourself; openpyxl will not evaluate. If both formula and cached value are
needed, write with a library that caches (or open & save once in Excel).

### Node

```js
// Object form — `formula` has NO leading '='.
ws.getCell('B10').value = { formula: 'SUM(B2:B9)' };
ws.getCell('D2').value = { formula: 'B2*C2' };

// Provide a cached result so non-Excel readers see a value.
ws.getCell('C10').value = { formula: 'AVERAGE(C2:C9)', result: 87.5 };

// Shared formula (write once, share to a range).
ws.getCell('E2').value = { formula: 'B2*C2', shareType: 'shared', ref: 'E2:E9' };
ws.fillFormula('F2:F9', 'B2*C2'); // helper: fills the range with a shared formula
```

---

## Number & date formats

`number_format` (Python) / `numFmt` (Node) is an Excel format code string. Common
codes: `"0"`, `"0.00"`, `"#,##0"`, `"#,##0.00"`, `"0%"`, `"0.0%"`,
`'"$"#,##0.00'`, `"yyyy-mm-dd"`, `"yyyy-mm-dd hh:mm"`, `"[h]:mm:ss"`,
`'#,##0;[Red](#,##0)'` (negatives red, parenthesized).

### Python

```python
ws["B2"] = 1234.5
ws["B2"].number_format = "#,##0.00"

ws["C2"] = 0.1875
ws["C2"].number_format = "0.0%"

ws["D2"] = 99999.5
ws["D2"].number_format = '"$"#,##0.00'

import datetime
ws["E2"] = datetime.datetime(2026, 6, 1, 9, 30)
ws["E2"].number_format = "yyyy-mm-dd hh:mm"
```

### Node

```js
ws.getCell('B2').value = 1234.5;
ws.getCell('B2').numFmt = '#,##0.00';

ws.getCell('C2').value = 0.1875;
ws.getCell('C2').numFmt = '0.0%';

ws.getCell('D2').value = 99999.5;
ws.getCell('D2').numFmt = '"$"#,##0.00';

ws.getCell('E2').value = new Date(2026, 5, 1, 9, 30);
ws.getCell('E2').numFmt = 'yyyy-mm-dd hh:mm';
```

---

## Styles: fonts, fills, borders, alignment

### Python

openpyxl style objects are **immutable** — build new ones and assign; do not
mutate a shared style in place across cells.

```python
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment, NamedStyle

# Header style applied per cell.
header_font = Font(name="Calibri", size=12, bold=True, color="FFFFFF")
header_fill = PatternFill("solid", fgColor="4472C4")  # ARGB or RGB hex, no '#'
center = Alignment(horizontal="center", vertical="center", wrap_text=True)
thin = Side(style="thin", color="999999")
box = Border(left=thin, right=thin, top=thin, bottom=thin)

for cell in ws[1]:                       # first row
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = center
    cell.border = box

# Reusable NamedStyle — register once, assign by name.
currency = NamedStyle(name="currency")
currency.number_format = '"$"#,##0.00'
currency.font = Font(color="006100")
wb.add_named_style(currency)
ws["D2"].style = "currency"
```

### Node

In exceljs, `cell.style` (and `font`/`fill`/`border`/`alignment`) is a plain
object you assign. Apply per cell, per row, per column, or to a range.

```js
const headerStyle = {
  font: { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
  alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  border: {
    top: { style: 'thin', color: { argb: 'FF999999' } },
    left: { style: 'thin', color: { argb: 'FF999999' } },
    bottom: { style: 'thin', color: { argb: 'FF999999' } },
    right: { style: 'thin', color: { argb: 'FF999999' } },
  },
};

ws.getRow(1).eachCell((cell) => { cell.style = headerStyle; });

// Whole column styling (also affects future cells in the column).
ws.getColumn('D').numFmt = '"$"#,##0.00';
ws.getColumn('D').font = { color: { argb: 'FF006100' } };
```

> exceljs colors are ARGB hex (8 chars, alpha first): `FF` + RRGGBB.

---

## Column widths, row heights, freeze panes

### Python

```python
ws.column_dimensions["A"].width = 28      # width in character units
ws.column_dimensions["B"].width = 12
ws.row_dimensions[1].height = 22          # height in points
ws.column_dimensions["C"].hidden = True

# Freeze panes: everything ABOVE & LEFT of this cell stays fixed.
ws.freeze_panes = "A2"     # freeze the header row
ws.freeze_panes = "B2"     # freeze row 1 AND column A
```

openpyxl has no true auto-fit; compute a width from content length:

```python
for col_cells in ws.columns:
    length = max((len(str(c.value)) for c in col_cells if c.value is not None), default=0)
    letter = col_cells[0].column_letter
    ws.column_dimensions[letter].width = min(length + 2, 60)
```

### Node

```js
ws.getColumn('A').width = 28;
ws.getColumn('B').width = 12;
ws.getRow(1).height = 22;
ws.getColumn('C').hidden = true;

// Freeze panes via the worksheet view.
ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]; // freeze col A + row 1
// Or just the header row: { state: 'frozen', ySplit: 1 }
```

---

## Merged cells, auto-filter, conditional formatting

### Python

```python
ws.merge_cells("A1:D1")               # merge a banner row; write to A1 only
ws["A1"] = "Quarterly Report"
# ws.unmerge_cells("A1:D1")

ws.auto_filter.ref = "A1:D100"        # filter dropdowns on the header row

from openpyxl.formatting.rule import ColorScaleRule, CellIsRule
from openpyxl.styles import Font, PatternFill
ws.conditional_formatting.add(
    "B2:B100",
    ColorScaleRule(start_type="min", start_color="FFAA0000",
                   end_type="max", end_color="FF00AA00"),
)
ws.conditional_formatting.add(
    "C2:C100",
    CellIsRule(operator="lessThan", formula=["0"],
               fill=PatternFill("solid", fgColor="FFC7CE"),
               font=Font(color="9C0006")),
)
```

### Node

```js
ws.mergeCells('A1:D1');
ws.getCell('A1').value = 'Quarterly Report';
// ws.unMergeCells('A1:D1');

ws.autoFilter = 'A1:D100';

ws.addConditionalFormatting({
  ref: 'C2:C100',
  rules: [{
    type: 'cellIs', operator: 'lessThan', formulae: ['0'], priority: 1,
    style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } } },
  }],
});
```

---

## Data validation (dropdowns)

### Python

```python
from openpyxl.worksheet.datavalidation import DataValidation

# Dropdown list (inline values — keep under ~255 chars total, else point at a range).
dv = DataValidation(type="list", formula1='"Low,Medium,High"', allow_blank=True)
dv.error = "Pick Low, Medium, or High"
dv.errorTitle = "Invalid value"
ws.add_data_validation(dv)
dv.add("C2:C100")

# Dropdown sourced from a range (can live on another sheet).
dv2 = DataValidation(type="list", formula1="=Lists!$A$1:$A$20")
ws.add_data_validation(dv2)
dv2.add("D2:D100")

# Numeric bound: whole number 1..5.
dv3 = DataValidation(type="whole", operator="between", formula1="1", formula2="5")
ws.add_data_validation(dv3)
dv3.add("E2:E100")
```

### Node

```js
ws.getCell('C2').dataValidation = {
  type: 'list', allowBlank: true,
  formulae: ['"Low,Medium,High"'],
  showErrorMessage: true, errorTitle: 'Invalid value',
  error: 'Pick Low, Medium, or High',
};

// From a range:
ws.getCell('D2').dataValidation = {
  type: 'list', allowBlank: true, formulae: ['=Lists!$A$1:$A$20'],
};

// Numeric bound:
ws.getCell('E2').dataValidation = {
  type: 'whole', operator: 'between', formulae: [1, 5],
  showErrorMessage: true,
};
```

---

## Charts

### Python (openpyxl native charts)

```python
from openpyxl.chart import BarChart, LineChart, PieChart, Reference, Series

# Data: A1 header "Month", B1 "Sales"; A2:A7 months, B2:B7 numbers.
chart = BarChart()
chart.type = "col"
chart.title = "Sales by month"
chart.x_axis.title = "Month"
chart.y_axis.title = "USD"

data = Reference(ws, min_col=2, min_row=1, max_row=7)   # include header row
cats = Reference(ws, min_col=1, min_row=2, max_row=7)
chart.add_data(data, titles_from_data=True)
chart.set_categories(cats)
chart.width = 18   # cm
chart.height = 10
ws.add_chart(chart, "D2")     # anchor top-left at D2

# Line / pie follow the same Reference pattern:
line = LineChart(); line.add_data(data, titles_from_data=True); line.set_categories(cats)
pie = PieChart();  pie.add_data(data, titles_from_data=True);  pie.set_categories(cats)
```

### Node (exceljs)

exceljs does **not** create native charts. Options:

1. Render the chart to a PNG (e.g. with a charting lib like `chartjs-node-canvas`)
   and embed it as an image:

```js
const imageId = wb.addImage({ filename: 'chart.png', extension: 'png' });
ws.addImage(imageId, 'D2:K20');          // place over a cell range
// or by explicit anchor:
ws.addImage(imageId, { tl: { col: 3, row: 1 }, ext: { width: 500, height: 300 } });
```

2. If a true editable chart object is required, use **Python/openpyxl** for that
   workbook. State this trade-off to the user rather than faking it.

---

## Reading workbooks

### Python

```python
from openpyxl import load_workbook

# data_only=True -> read Excel's CACHED computed values (formulas come back as
# their last-saved result; None if the file was never opened in Excel).
wb = load_workbook("report.xlsx", data_only=True)
ws = wb["Data"]

print(ws["B2"].value)                 # single cell
print(ws.max_row, ws.max_column)      # used range

# Iterate rows as tuples of values.
for row in ws.iter_rows(min_row=2, values_only=True):
    name, score = row[0], row[1]

# Iterate a column.
for (cell,) in ws.iter_cols(min_col=1, max_col=1, min_row=2, values_only=False):
    pass
```

Without `data_only=True`, formula cells return the formula string (`"=SUM(...)"`).
You cannot have both the formula and the cached value from a single load.

### Node

```js
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile('report.xlsx');
const ws = wb.getWorksheet('Data');

console.log(ws.getCell('B2').value);
console.log(ws.rowCount, ws.columnCount);

ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
  const [name, score] = [row.getCell(1).value, row.getCell(2).value];
});

// Formula cells read back as { formula, result } objects.
const c = ws.getCell('B10').value;     // { formula: 'SUM(B2:B9)', result: 123 }
```

---

## Streaming large files

Use streaming when a workbook is too large to hold in memory (tens of thousands+
of rows). Streaming modes are append-only / forward-only.

### Python — write-only & read-only

```python
# WRITE-ONLY: rows are flushed as you append; you cannot read back or random-access.
from openpyxl import Workbook
wb = Workbook(write_only=True)
ws = wb.create_sheet("Big")
ws.append(["id", "value"])
for i in range(1_000_000):
    ws.append([i, i * 1.5])
wb.save("big.xlsx")

# Optional styled cells in write-only mode use WriteOnlyCell:
from openpyxl.cell import WriteOnlyCell
from openpyxl.styles import Font
cell = WriteOnlyCell(ws, value="Header")
cell.font = Font(bold=True)
ws.append([cell])

# READ-ONLY: constant memory, forward iteration only.
wb = load_workbook("big.xlsx", read_only=True)
ws = wb.active
for row in ws.iter_rows(values_only=True):
    process(row)
wb.close()    # important in read-only mode — releases the file handle
```

### Node — streaming writer & reader

```js
const ExcelJS = require('exceljs');

// Streaming WRITER — commit rows/sheets to flush them to disk.
const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: 'big.xlsx' });
const ws = wb.addWorksheet('Big');
ws.addRow(['id', 'value']).commit();
for (let i = 0; i < 1_000_000; i++) {
  ws.addRow([i, i * 1.5]).commit();   // commit frees the row from memory
}
ws.commit();
await wb.commit();

// Streaming READER — process rows as they parse.
const reader = new ExcelJS.stream.xlsx.WorkbookReader('big.xlsx', {});
for await (const worksheet of reader) {
  for await (const row of worksheet) {
    const values = row.values;        // 1-based; values[0] is undefined
  }
}
```

---

## Gotchas

| Pitfall | Fix |
|---|---|
| Expecting the library to compute formulas | It does not. Excel computes on open; for non-Excel readers cache the result (exceljs `result`) or pre-compute the value yourself. |
| Reading `None` for every formula in Python | `load_workbook(path, data_only=True)` reads cached values, but only if Excel saved them; a file written purely by openpyxl has no cache. |
| Colors with a leading `#` | openpyxl wants `"RRGGBB"` or `"AARRGGBB"` (no `#`); exceljs wants `{ argb: 'FFRRGGBB' }` (alpha first). |
| Mutating a shared openpyxl style across cells | Style objects are immutable; create per-cell or use a `NamedStyle`. |
| Random-access in write-only/streaming mode | Not supported — it is append/forward-only. Buffer or use the normal mode. |
| JS `Date` month off by one | `new Date(2026, 5, 1)` is June 1 (month is 0-based). |
| Streaming reader `row.values[0]` is `undefined` | exceljs arrays are 1-based; index 0 is a placeholder. |
| Forgetting `wb.close()` in openpyxl read-only | Leaks the file handle on long-running processes. |
| Writing dates without a number format | They render as serial numbers; set a date `number_format`/`numFmt`. |
| Huge inline data-validation lists (>255 chars) | Put the options in a range and reference it (`=Lists!$A$1:$A$20`). |

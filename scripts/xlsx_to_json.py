"""Convert every sheet of an .xlsx workbook to a JSON object {sheet_name: [[cell, ...], ...]}.
Usage: python3 -I xlsx_to_json.py input.xlsx output.json"""
import json, sys, datetime
import openpyxl

src, dst = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src, data_only=True, read_only=True)
out = {}
for ws in wb.worksheets:
    rows = []
    for row in ws.iter_rows(values_only=True):
        cells = []
        for v in row:
            if isinstance(v, (datetime.date, datetime.datetime)):
                v = v.isoformat()
            cells.append(v)
        while cells and cells[-1] is None:
            cells.pop()
        rows.append(cells)
    while rows and not rows[-1]:
        rows.pop()
    out[ws.title] = rows
with open(dst, "w") as f:
    json.dump(out, f)
print(f"[xlsx] {src} -> {len(out)} sheets")

from tempfile import NamedTemporaryFile

from docx import Document

from export_summary import build_itinery_rows


TABLE_HEADERS = ["类型", "日期/天数", "城市/路线", "名称", "详情", "联系电话/航班号"]
TABLE_KEYS = ["type", "date", "route", "name", "details", "contact"]


def export_to_word(itinerary, state=None):
    doc = Document()
    doc.add_heading("itinery", 0)

    rows = build_itinery_rows(itinerary, state or {})
    table = doc.add_table(rows=1, cols=len(TABLE_HEADERS))
    table.style = "Table Grid"

    header_cells = table.rows[0].cells
    for index, header in enumerate(TABLE_HEADERS):
        header_cells[index].text = header

    if rows:
        for row in rows:
            cells = table.add_row().cells
            for index, key in enumerate(TABLE_KEYS):
                cells[index].text = str(row.get(key, "-"))
    else:
        cells = table.add_row().cells
        cells[0].text = "暂无行程"
        for index in range(1, len(TABLE_HEADERS)):
            cells[index].text = "-"

    if not itinerary:
        doc.add_paragraph("No itinerary generated.")
    else:
        for day in itinerary:
            day_label = day.get("day", "-")
            city = day.get("city", "Unknown")
            doc.add_heading(f"Day {day_label} - {city}", level=1)

            doc.add_paragraph("Activities:")
            for activity in day.get("activities", []):
                doc.add_paragraph(f"- {activity}")

            doc.add_paragraph("Food:")
            for food in day.get("food", []):
                doc.add_paragraph(f"- {food}")

            doc.add_paragraph(f"Cost: {day.get('cost', 'N/A')}")

    with NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
        file_path = tmp.name

    doc.save(file_path)
    return file_path

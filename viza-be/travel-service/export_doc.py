from tempfile import NamedTemporaryFile

from docx import Document

from export_summary import (
    TABLE_KEYS,
    build_itinery_rows,
    get_table_headers,
    localize_itinery_rows,
    normalize_export_language,
)


def export_to_word(itinerary, state=None):
    state = state or {}
    export_language = normalize_export_language(state.get("export_language"))
    doc = Document()
    title = "itinery" if export_language != "en" else "itinerary"
    doc.add_heading(title, 0)

    rows = localize_itinery_rows(build_itinery_rows(itinerary, state), export_language)
    headers = get_table_headers(export_language)
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"

    header_cells = table.rows[0].cells
    for index, header in enumerate(headers):
        header_cells[index].text = header

    if rows:
        for row in rows:
            cells = table.add_row().cells
            for index, key in enumerate(TABLE_KEYS):
                cells[index].text = str(row.get(key, "-"))
    else:
        cells = table.add_row().cells
        cells[0].text = "暂无行程"
        for index in range(1, len(headers)):
            cells[index].text = "-"

    if not itinerary:
        doc.add_paragraph("No itinerary generated.")
    else:
        for day in itinerary:
            day_label = day.get("day", "-")
            city = day.get("city", "Unknown")
            heading = f"Day {day_label} - {city}"
            if export_language == "bilingual":
                heading = f"第 {day_label} 天 - {city} / {heading}"
            doc.add_heading(heading, level=1)

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

from tempfile import NamedTemporaryFile

from docx import Document


def export_to_word(itinerary):
    doc = Document()
    doc.add_heading("Travel Plan", 0)

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

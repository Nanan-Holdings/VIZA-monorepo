from tempfile import NamedTemporaryFile
from pathlib import Path
from html import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from export_summary import (
    TABLE_KEYS,
    build_itinery_rows,
    get_table_headers,
    localize_export_text,
    localize_itinery_rows,
    normalize_export_language,
)

PDF_FONT = "TravelCJKFont"
CID_FALLBACK_FONT = "STSong-Light"
PAGE_WIDTH, PAGE_HEIGHT = letter
LEFT_MARGIN = 50
RIGHT_MARGIN = 50
TOP_MARGIN = 50
BOTTOM_MARGIN = 50


def _register_font():
    try:
        pdfmetrics.getFont(PDF_FONT)
        return PDF_FONT
    except KeyError:
        pass

    # Prefer embedded TTF/TTC fonts so Chinese characters render reliably.
    # This also works better on Chrome PDF preview than CID fallback fonts.
    font_candidates: list[tuple[str, int]] = [
        ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 0),
        ("/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf", 0),
        ("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc", 0),
        ("/usr/share/fonts/truetype/noto/NotoSansSC-Regular.otf", 0),
        ("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", 0),
        ("/mnt/c/Windows/Fonts/msyh.ttc", 0),
        ("/mnt/c/Windows/Fonts/simsun.ttc", 0),
        ("/mnt/c/Windows/Fonts/simhei.ttf", 0),
        (r"C:\Windows\Fonts\msyh.ttc", 0),
        (r"C:\Windows\Fonts\simsun.ttc", 0),
        (r"C:\Windows\Fonts\simhei.ttf", 0),
    ]

    for font_path, subfont_index in font_candidates:
        if not Path(font_path).exists():
            continue
        try:
            pdfmetrics.registerFont(
                TTFont(PDF_FONT, font_path, subfontIndex=subfont_index)
            )
            return PDF_FONT
        except Exception:
            continue

    # Last fallback: built-in CID font (may depend on viewer support).
    try:
        pdfmetrics.getFont(CID_FALLBACK_FONT)
    except KeyError:
        pdfmetrics.registerFont(UnicodeCIDFont(CID_FALLBACK_FONT))
    return CID_FALLBACK_FONT


def _paragraph(text, style):
    return Paragraph(escape(str(text)), style)


def _section_title(language):
    return "itinerary" if language == "en" else "行程"


def _build_table(rows, language, cell_style, active_font):
    localized_rows = localize_itinery_rows(rows, language)
    headers = get_table_headers(language)
    table_data = [[_paragraph(header, cell_style) for header in headers]]
    if localized_rows:
        for row in localized_rows:
            table_data.append([
                _paragraph(row.get(key, "-"), cell_style) for key in TABLE_KEYS
            ])
    else:
        table_data.append(
            [
                _paragraph(
                    ("No itinerary" if language == "en" else "暂无行程")
                    if index == 0
                    else "-",
                    cell_style,
                )
                for index in range(len(headers))
            ]
        )

    return Table(
        table_data,
        colWidths=[50, 38, 58, 68, 82, 150, 66],
        repeatRows=1,
        style=TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eadcff")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#2d1635")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d8c5ff")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTNAME", (0, 0), (-1, -1), active_font),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        ),
    )


def _append_language_section(story, itinerary, rows, language, styles, active_font):
    title_style, cell_style, day_style = styles
    story.append(_paragraph(_section_title(language), title_style))
    story.append(_build_table(rows, language, cell_style, active_font))

    if itinerary:
        story.append(Spacer(1, 14))
        for day in itinerary:
            city = localize_export_text(day.get("city", "Unknown"), language, "route")
            activities = [
                localize_export_text(activity, language, "name")
                for activity in day.get("activities", [])
            ]
            label = f"Day {day.get('day', '-')} - {city}: " if language == "en" else f"第 {day.get('day', '-')} 天 - {city}："
            story.append(
                _paragraph(
                    f"{label}{', '.join(activities) or '-'}",
                    day_style,
                )
            )


def export_to_pdf(itinerary, state=None):
    state = state or {}
    export_language = normalize_export_language(state.get("export_language"))
    active_font = _register_font()

    with NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        file_path = tmp.name

    doc = SimpleDocTemplate(
        file_path,
        pagesize=letter,
        leftMargin=LEFT_MARGIN,
        rightMargin=RIGHT_MARGIN,
        topMargin=TOP_MARGIN,
        bottomMargin=BOTTOM_MARGIN,
    )
    title_style = ParagraphStyle(
        "TravelTitle",
        fontName=active_font,
        fontSize=22,
        leading=28,
        spaceAfter=14,
    )
    cell_style = ParagraphStyle(
        "TravelTableCell",
        fontName=active_font,
        fontSize=8.5,
        leading=11,
    )
    day_style = ParagraphStyle(
        "TravelDay",
        fontName=active_font,
        fontSize=11,
        leading=15,
        spaceBefore=8,
    )

    rows = build_itinery_rows(itinerary, state)
    story = []
    styles = (title_style, cell_style, day_style)
    if export_language == "bilingual":
        _append_language_section(story, itinerary, rows, "zh", styles, active_font)
        story.append(PageBreak())
        _append_language_section(story, itinerary, rows, "en", styles, active_font)
    else:
        _append_language_section(story, itinerary, rows, export_language, styles, active_font)

    doc.build(story)
    return file_path

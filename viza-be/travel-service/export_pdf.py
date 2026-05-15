from tempfile import NamedTemporaryFile
from pathlib import Path
from html import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from export_summary import build_itinery_rows

PDF_FONT = "TravelCJKFont"
CID_FALLBACK_FONT = "STSong-Light"
PAGE_WIDTH, PAGE_HEIGHT = letter
LEFT_MARGIN = 50
RIGHT_MARGIN = 50
TOP_MARGIN = 50
BOTTOM_MARGIN = 50
TABLE_HEADERS = ["类型", "日期/天数", "城市/路线", "名称", "详情", "联系电话/航班号"]
TABLE_KEYS = ["type", "date", "route", "name", "details", "contact"]


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


def export_to_pdf(itinerary, state=None):
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

    rows = build_itinery_rows(itinerary, state or {})
    table_data = [[_paragraph(header, cell_style) for header in TABLE_HEADERS]]
    if rows:
        for row in rows:
            table_data.append([
                _paragraph(row.get(key, "-"), cell_style) for key in TABLE_KEYS
            ])
    else:
        table_data.append(
            [
                _paragraph("暂无行程" if index == 0 else "-", cell_style)
                for index in range(len(TABLE_HEADERS))
            ]
        )

    story = [_paragraph("itinery", title_style)]
    story.append(
        Table(
            table_data,
            colWidths=[42, 66, 78, 94, 160, 86],
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
    )

    if itinerary:
        story.append(Spacer(1, 14))
        for day in itinerary:
            story.append(
                _paragraph(
                    f"Day {day.get('day', '-')} - {day.get('city', 'Unknown')}："
                    f"{'、'.join(day.get('activities', [])) or '-'}",
                    day_style,
                )
            )

    doc.build(story)
    return file_path

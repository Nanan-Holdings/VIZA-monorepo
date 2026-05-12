from tempfile import NamedTemporaryFile
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

PDF_FONT = "TravelCJKFont"
CID_FALLBACK_FONT = "STSong-Light"
PAGE_WIDTH, PAGE_HEIGHT = letter
LEFT_MARGIN = 50
RIGHT_MARGIN = 50
TOP_MARGIN = 50
BOTTOM_MARGIN = 50
BODY_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN


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


def _draw_wrapped_text(c, text, x, y, font_name, font_size, line_height):
    lines = simpleSplit(str(text), font_name, font_size, BODY_WIDTH - (x - LEFT_MARGIN))
    for line in lines:
        c.drawString(x, y, line)
        y -= line_height
    return y


def _new_page(c, font_name):
    c.showPage()
    c.setFont(font_name, 12)
    return PAGE_HEIGHT - TOP_MARGIN


def export_to_pdf(itinerary):
    active_font = _register_font()

    with NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        file_path = tmp.name

    c = canvas.Canvas(file_path, pagesize=letter)
    c.setFont(active_font, 12)

    y = PAGE_HEIGHT - TOP_MARGIN

    if not itinerary:
        _draw_wrapped_text(c, "No itinerary generated.", LEFT_MARGIN, y, active_font, 12, 16)
    else:
        for day in itinerary:
            if y < BOTTOM_MARGIN + 120:
                y = _new_page(c, active_font)

            c.setFont(active_font, 16)
            y = _draw_wrapped_text(
                c,
                f"Day {day.get('day', '-')} - {day.get('city', 'Unknown')}",
                LEFT_MARGIN,
                y,
                active_font,
                16,
                22,
            )

            c.setFont(active_font, 13)
            y = _draw_wrapped_text(
                c, "Activities:", LEFT_MARGIN + 10, y - 2, active_font, 13, 18
            )
            c.setFont(active_font, 12)
            for activity in day.get("activities", []):
                if y < BOTTOM_MARGIN + 40:
                    y = _new_page(c, active_font)
                y = _draw_wrapped_text(
                    c, f"- {activity}", LEFT_MARGIN + 20, y, active_font, 12, 16
                )

            c.setFont(active_font, 13)
            y = _draw_wrapped_text(c, "Food:", LEFT_MARGIN + 10, y - 2, active_font, 13, 18)
            c.setFont(active_font, 12)
            for food in day.get("food", []):
                if y < BOTTOM_MARGIN + 40:
                    y = _new_page(c, active_font)
                y = _draw_wrapped_text(c, f"- {food}", LEFT_MARGIN + 20, y, active_font, 12, 16)

            c.setFont(active_font, 13)
            y = _draw_wrapped_text(
                c,
                f"Cost: {day.get('cost', 'N/A')}",
                LEFT_MARGIN + 10,
                y - 2,
                active_font,
                13,
                18,
            )
            y -= 12

    c.save()
    return file_path

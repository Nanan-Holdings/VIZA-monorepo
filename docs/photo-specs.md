# Per-jurisdiction photo specs (DOC-001)

> Last reviewed: 2026-05-07.

The runner can only consume an applicant photo that matches the
destination portal's spec — wrong size, dark background, or wrong
head height all reject at the portal upload step. This table is the
source of truth; `viza-fe/internal-website/lib/photo/specs.ts`
mirrors it in code.

| Country / package | Width × Height (mm) | Width × Height (px @ 300 dpi) | Background | Head height | File format | Max file size |
|---|---|---|---|---|---|---|
| United States — DS-160 (B1/B2) | 51 × 51 | 600 × 600 | white / off-white | 25–35 mm | JPEG | 240 KB |
| United Kingdom — Standard Visitor | 35 × 45 | 413 × 531 | light grey / cream | 29–34 mm | JPEG | 5 MB |
| EU / Schengen — France-Visas / Italy VFS-CN | 35 × 45 | 413 × 531 | light grey / off-white | 32–36 mm | JPEG | 240 KB |
| Vietnam — VN_E_VISA | 40 × 60 | 472 × 709 | white | 28–33 mm | JPEG | 1 MB |
| Australia — Subclass 600 | 35 × 45 | 413 × 531 | plain light | 32–36 mm | JPEG | 1 MB |
| Japan — JP_TOURIST | 35 × 45 | 413 × 531 | white | 32–36 mm | JPEG | 2 MB |
| Indonesia — B211A / ID_C1 | 40 × 60 | 472 × 709 | red (B211A) / white | 30–35 mm | JPEG | 200 KB |
| Egypt — EG_E_VISA | 40 × 60 | 472 × 709 | white | 30–35 mm | JPEG | 1 MB |
| South Korea — K-ETA / C-3-9 | 35 × 45 | 413 × 531 | white | 32–36 mm | JPEG | 200 KB |
| Thailand — TH_TOURIST_E_VISA | 35 × 45 | 413 × 531 | white | 32–36 mm | JPEG | 2 MB |
| Malaysia — MY_TOURIST_E_VISA | 35 × 50 | 413 × 591 | white / blue | 30–35 mm | JPEG | 1 MB |
| Singapore — SG_VISITOR_VISA | 35 × 45 | 413 × 531 | white | 25–35 mm | JPEG | 60 KB |
| Hong Kong — HK_VISIT_VISA | 40 × 50 | 472 × 591 | white | 32–36 mm | JPEG | 2 MB |
| Macau — MO_VISIT_VISA | 35 × 45 | 413 × 531 | white | 30–35 mm | JPEG | 2 MB |
| New Zealand — NZ_VISITOR_VISA | 35 × 45 | 413 × 531 | plain light | 25–35 mm | JPEG | 3 MB |
| Russia — RU_E_VISA | 35 × 45 | 413 × 531 | white | 30–35 mm | JPEG | 5 MB |
| Turkey — TR_E_VISA | 50 × 60 | 591 × 709 | white | 32–36 mm | JPEG | 2 MB |
| UAE — AE_TOURIST_VISA | 43 × 55 | 508 × 650 | white | 32–36 mm | JPEG | 1 MB |
| Canada — CA_TRV | 35 × 45 | 413 × 531 | plain white | 31–36 mm | JPEG | 3 MB |
| Maldives — MV_IMUGA | 35 × 45 | 413 × 531 | white | 32–36 mm | JPEG | 1 MB |
| Philippines — PH_TEMPORARY_VISITOR | 50 × 50 | 591 × 591 | white | 28–32 mm | JPEG | 500 KB |
| Cambodia — KH_TOURIST_E_VISA | 35 × 45 | 413 × 531 | white | 30–35 mm | JPEG | 2 MB |
| Laos — LA_TOURIST_E_VISA | 35 × 45 | 413 × 531 | white | 30–35 mm | JPEG | 2 MB |
| Sri Lanka — LK_ETA | 35 × 45 | 413 × 531 | white | 30–35 mm | JPEG | 200 KB |
| India — IN_E_VISA | 51 × 51 | 600 × 600 | white | 25–35 mm | JPEG | 1 MB |
| South Africa — ZA_VISITOR_VISA | 35 × 45 | 413 × 531 | plain light | 30–35 mm | JPEG | 5 MB |

Sources: each portal's own published spec (snapshot above; portals
sometimes drift). Counsel TODO at public launch: confirm each row
against the live portal documentation.

## Common ICAO baseline

These rules cut across every row above and are validated client- and
server-side independently of the per-country pixel sizes:

- Face fully visible, eyes open, mouth closed, neutral expression.
- No hat / sunglasses (religious head-covering allowed where the
  portal explicitly permits).
- Plain background (light, uniform).
- Sharp focus, even lighting, no shadows on the face or background.
- Head centred, looking directly at the camera.
- Photo taken in the last 6 months.

Rules above are surfaced to the applicant as part of the capture UI;
server-side we validate the deterministic ones (file format, byte
size, pixel dimensions). Visual checks (background colour, head
height, expression) require ML and are deferred to a follow-on
enrichment pass.

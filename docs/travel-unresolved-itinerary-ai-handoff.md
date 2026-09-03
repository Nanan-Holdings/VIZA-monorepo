# Unresolved VIZA Itinerary Research Handoff

## What this file is for

Use this as the complete prompt for another AI with current web-search or
travel-search access. The output will be reviewed by a human before it is used
as intended-travel data. Do not submit any visa, arrival card, booking, payment,
or government-portal form.

This handoff covers the 46 active VIZA application routes that did not receive
new, verified itinerary fields in the latest local autofill run. The local run
saved 30 tourism-purpose fields across 29 applications. That does **not** mean
any flight or hotel has been booked.

## Frozen trip context

- Traveller count: 1
- Purpose: tourism only
- Origin: Singapore, Singapore
- Final return: Singapore, Singapore
- Earliest/fixed planning start: 2026-10-29
- Total planning envelope: 365 days
- Planning budget: CNY 438,000
- Status of every result: `DRAFT / UNCONFIRMED / UNBOOKED`
- Duplicate products for one country must reuse the same physical trip facts.
- Do not create simultaneous trips merely because a country has two VIZA products.

## Non-negotiable truth rules

1. Research current flight and accommodation candidates from live, attributable
   sources. Include a direct source URL and the UTC retrieval time for every
   candidate.
2. Never claim that a candidate is booked, held, paid, ticketed, reserved, or
   confirmed. Do not create booking references, ticket numbers, PNRs, receipt
   numbers, or confirmation numbers.
3. Only report a flight number, airport, schedule, hotel name, street address,
   telephone number, or price when the cited source explicitly provides it.
   Otherwise return `NEEDS HUMAN CONFIRMATION`.
4. Late-2027 airline or hotel inventory may not yet be published. In that case,
   return `SCHEDULE NOT YET PUBLISHED`; do not extrapolate a flight number or
   price from another date.
5. Do not generate passport facts, nationality/residence facts, health answers,
   customs answers, criminal-history answers, immigration answers, employment
   or financial answers, transit declarations, or any other legal declaration.
6. Transit status must be `NEEDS HUMAN CONFIRMATION` unless it follows
   unambiguously from a cited, selected routing and is then still labelled as a
   proposed routing fact.
7. Do not determine visa eligibility or application windows from this travel
   research. Those require a separate current official-source check.
8. Prefer a geographically sensible continuous route, but never change the
   frozen origin, start date, traveller count, purpose, or total duration.

## Unresolved active application routes

| Country | VIZA route code | Planning city |
|---|---|---|
| Argentina | `tourist_visa_or_ave` | Buenos Aires |
| Australia | `visitor_subclass_600` | Sydney |
| Cambodia | `tourist_evisa` | Phnom Penh |
| Canada | `CA_TRV` | Toronto |
| Chile | `tourist_visa` | Santiago |
| China | `tourist_l_visa` | Beijing |
| Colombia | `check_mig_or_visitor_visa` | Bogotá |
| Cuba | `dviajeros_entry_form` | Havana |
| Dominican Republic | `eticket_entry_exit` | Santo Domingo |
| Egypt | `evisa_tourism` | Cairo |
| India | `IN_E_VISA` | New Delhi |
| Indonesia | `ID_C1_TOURIST` | Jakarta |
| Indonesia | `ID_B1_EVOA` | Jakarta |
| Ireland | `short_stay_c_visit_visa` | Dublin |
| Israel | `eta_il_or_visitor_visa` | Jerusalem |
| Japan | `short_term_tourism_evisa` | Tokyo |
| Japan | `JP_VISIT_JAPAN_WEB` | Tokyo |
| Jordan | `evisa_or_visitor_visa` | Amman |
| Kenya | `KE_ETA` | Nairobi |
| Laos | `LA_TOURIST_E_VISA` | Vientiane |
| Malaysia | `MY_MDAC_ARRIVAL_CARD` | Kuala Lumpur |
| Maldives | `tourist_visa_on_arrival` | Malé |
| Mexico | `visitor_visa_or_exemption` | Mexico City |
| Morocco | `visa_free_or_evisa` | Rabat |
| Nepal | `tourist_visa_on_arrival` | Kathmandu |
| New Zealand | `visitor_visa` | Auckland |
| Oman | `OM_TOURIST_E_VISA` | Muscat |
| Peru | `tourist_visa` | Lima |
| Philippines | `PH_ETRAVEL_ARRIVAL_CARD` | Manila |
| Philippines | `PH_ETRAVEL_DEPARTURE_CARD` | Manila |
| Qatar | `hayya_a1_tourist_visa` | Doha |
| Saudi Arabia | `SA_E_VISA` | Riyadh |
| Singapore | `SG_ARRIVAL_CARD` | Singapore |
| South Africa | `visitor_visa_tourism` | Cape Town |
| South Korea | `KR_C39_SHORT_TERM_VISIT` | Seoul |
| South Korea | `KR_E_ARRIVAL_CARD` | Seoul |
| Sri Lanka | `eta_tourism` | Colombo |
| Taiwan | `TW_ENTRY_PERMIT` | Taipei |
| Tanzania | `TZ_TOURIST_E_VISA` | Dodoma |
| Thailand | `TH_TDAC_ARRIVAL_CARD` | Bangkok |
| Turkiye | `TR_E_VISA` | Ankara |
| United Arab Emirates | `AE_TOURIST_VISA` | Dubai |
| United States | `DS160` | New York City |
| Vietnam | `evisa_tourism` | Hanoi |
| Vietnam | `VN_PREARRIVAL_DECLARATION` | Hanoi |
| France | `EU_SCHENGEN_C_SHORT_STAY` | Paris |

## Required output

Return both:

1. A concise Markdown table for human review.
2. A JSON array using the exact contract below.

```json
[
  {
    "country": "Japan",
    "route_codes": ["short_term_tourism_evisa", "JP_VISIT_JAPAN_WEB"],
    "city": "Tokyo",
    "proposed_arrival_date": "YYYY-MM-DD",
    "proposed_departure_date": "YYYY-MM-DD",
    "entry_port": {
      "name": "EXACT SOURCE VALUE OR NEEDS HUMAN CONFIRMATION",
      "code": "IATA/PORT CODE OR NEEDS HUMAN CONFIRMATION"
    },
    "exit_port": {
      "name": "EXACT SOURCE VALUE OR NEEDS HUMAN CONFIRMATION",
      "code": "IATA/PORT CODE OR NEEDS HUMAN CONFIRMATION"
    },
    "inbound_transport": {
      "mode": "flight/rail/road/sea",
      "operator": "EXACT SOURCE VALUE OR NEEDS HUMAN CONFIRMATION",
      "service_number": "EXACT SOURCE VALUE OR NEEDS HUMAN CONFIRMATION",
      "scheduled_departure": "ISO-8601 OR SCHEDULE NOT YET PUBLISHED",
      "scheduled_arrival": "ISO-8601 OR SCHEDULE NOT YET PUBLISHED",
      "source_url": "https://...",
      "retrieved_at_utc": "YYYY-MM-DDTHH:mm:ssZ",
      "status": "UNBOOKED"
    },
    "outbound_transport": {
      "mode": "flight/rail/road/sea",
      "operator": "EXACT SOURCE VALUE OR NEEDS HUMAN CONFIRMATION",
      "service_number": "EXACT SOURCE VALUE OR NEEDS HUMAN CONFIRMATION",
      "scheduled_departure": "ISO-8601 OR SCHEDULE NOT YET PUBLISHED",
      "scheduled_arrival": "ISO-8601 OR SCHEDULE NOT YET PUBLISHED",
      "source_url": "https://...",
      "retrieved_at_utc": "YYYY-MM-DDTHH:mm:ssZ",
      "status": "UNBOOKED"
    },
    "accommodation": {
      "name": "EXACT SOURCE VALUE OR NEEDS HUMAN CONFIRMATION",
      "street_address": "EXACT SOURCE VALUE OR NEEDS HUMAN CONFIRMATION",
      "city": "Tokyo",
      "postal_code": "EXACT SOURCE VALUE OR NEEDS HUMAN CONFIRMATION",
      "country": "Japan",
      "public_phone": "EXACT SOURCE VALUE OR NEEDS HUMAN CONFIRMATION",
      "public_email": "EXACT SOURCE VALUE OR NEEDS HUMAN CONFIRMATION",
      "official_website": "https://...",
      "source_url": "https://...",
      "retrieved_at_utc": "YYYY-MM-DDTHH:mm:ssZ",
      "status": "UNBOOKED"
    },
    "purpose": "tourism",
    "transit_status": "NEEDS HUMAN CONFIRMATION",
    "human_review_notes": []
  }
]
```

## Final validation checklist for the other AI

- Every unresolved country-and-route pair appears exactly once, grouped by
  physical trip when the country has duplicate products.
- Dates form one non-overlapping sequence within the 365-day envelope.
- Every exact flight/hotel/contact fact has a live source URL and retrieval time.
- Unpublished or missing facts are explicit; no placeholder is presented as a
  confirmed fact.
- No passport, declaration, eligibility, payment, booking, or government-form
  action is included.

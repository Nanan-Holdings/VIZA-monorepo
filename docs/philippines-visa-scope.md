# Philippines 9(a) Visa + eTravel Scope - v2

**Version:** 2.0  
**Status:** Active  
**Updated:** 2026-06-28

## 1. Canonical Packages

Philippines now uses two separate VIZA package boundaries:

- `PH_TEMPORARY_VISITOR_VISA`: Philippines 9(a) Temporary Visitor Visa. This remains the consular/paper visa package for travellers who need a visa.
- `PH_ETRAVEL_ARRIVAL_CARD`: Philippines eTravel Arrival Card. This is a standalone digital arrival/departure declaration and must not be modeled as a 9(a) visa variant.

Official eTravel sources: `https://etravel.gov.ph/` and `https://customs.etravel.gov.ph/frequently-asked-questions`.

## 2. eTravel v1 Scope

`PH_ETRAVEL_ARRIVAL_CARD` covers v1 single-traveller arriving foreign passenger registration.

Collect only official eTravel declaration data: personal/passport/contact details, residence, occupation, travel type, transport type, flight/vessel details, arrival/departure dates, origin country, port of entry, Philippines address, purpose, health declaration, customs/baggage declaration, currency declaration, and final declaration.

eTravel is free and normally can be registered only within 72 hours before arrival or departure. VIZA queues future-dated applications as scheduled until the official window opens.

## 3. Evidence Contract

Successful eTravel submission requires official evidence: QR code, reference number, final confirmation screenshot/download where available, and portal response summary. A generic portal screenshot is not success evidence.

## 4. Out Of Scope

Family/group registration, departing Filipino passengers, crew, cruise-specific branches, and deep customs itemization are later extensions. 9(a) PDF rendering remains separate from eTravel runner work.

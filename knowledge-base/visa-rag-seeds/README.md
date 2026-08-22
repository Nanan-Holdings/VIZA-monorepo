# Country Visa RAG Seeds

This directory is the source of truth for country-level visa RAG knowledge.

Each file in `countries/*.json` owns one country's visitor/tourism visa knowledge and should evolve with that country's dedicated form-filling workflow. Keep country-specific rules, official source URLs, application-route notes, form-intake context, and future form-flow context in the same country seed instead of adding a shared multi-country seed.

`countries/taiwan.json` keeps the conditional `TW_ENTRY_PERMIT` route for eligible mainland Chinese residents abroad separate from the official-only `TW_ARRIVAL_CARD` declaration.

The reviewed product codes are intentionally stable and are not
interchangeable with the old route aliases. The five tourist schemas added in
the 2026-08-16 official-source audit are:

- Canada: `CA_TRV` (tourist TRV only; eTA is separate)
- Türkiye: `TR_E_VISA`
- India: `IN_E_VISA` (e-Tourist only)
- Saudi Arabia: `SA_E_VISA` (VisitSaudi Tourist eVisa only)
- United Arab Emirates: `AE_TOURIST_VISA` (ICP self-sponsored five-year
  multiple-entry transaction 783 only)

The existing reviewed product codes are:

- Indonesia: `ID_B1_EVOA`, `ID_C1_TOURIST`
- Vietnam: `VN_E_VISA`, `VN_PREARRIVAL_DECLARATION`
- Singapore: `SG_VISITOR_VISA`, `SG_ARRIVAL_CARD`
- Malaysia: `MY_TOURIST_E_VISA`, `MY_MDAC_ARRIVAL_CARD`
- Thailand: `TH_TOURIST_E_VISA`, `TH_TDAC_ARRIVAL_CARD`
- South Korea: `KR_C39_SHORT_TERM_VISIT` (K-ETA remains an external travel-authorisation route)
- United States: `DS160`
- France: `EU_SCHENGEN_C_SHORT_STAY`
- Philippines: `PH_TEMPORARY_VISITOR_VISA`, `PH_ETRAVEL_ARRIVAL_CARD`
- United Kingdom: `UK_STANDARD_VISITOR`
- Taiwan: `TW_ENTRY_PERMIT`; `TW_ARRIVAL_CARD` remains an official-only arrival-declaration route
- Japan: `JP_VISIT_JAPAN_WEB` (Visit Japan Web immigration/customs declaration;
  live third-party automation remains gated on current Digital Agency terms and
  authorization)
- Kenya: `KE_ETA` (official electronic travel authorisation; standard official
  fee baseline USD 30; no F88 product)

Visa, travel authorisation and arrival/departure declarations are separate
products. A `form_requirements` document must exist independently for every
internal product; an arrival declaration must never be presented as a visa.

Every country seed should include exactly one `documentType: "form_requirements"`
document for each supported `visaType`/product. Visa and arrival-card products
must have separate requirement and form-intake documents even when they share a
destination. This document is the bridge between RAG and future form
automation: it describes the official application channel, the form fields
VIZA should collect before filling, the supporting documents/uploads to
prepare, and review/submission guardrails.

Each `form_requirements` document should also carry the shared
`standard_passport_identity_field_rules` chunk. Field-level copilot retrieval
uses this chunk for standard-answer questions such as passport issuing
authority, place of issue, passport type, nationality, passport dates, and
other identity fields where the correct answer must come from the passport,
official identity document, MRZ, or official dropdown options rather than a
free-form guess. The chunk must treat issuing country, place of issue, and
issuing authority as distinct fields. Authority names must never be used as
place-of-issue examples, and a country should be entered only when the official
field asks for an issuing country or provides a country-only selector.

Country seeds may also carry an `official_field_answer_norms` chunk inside the
same `form_requirements` document. Generate or refresh this chunk with
`npm run enrich:field-answer-norms-rag` from `viza-be/agent-backend`; the script
crawls the official or authorized URLs already present in the seed, extracts
field-answer evidence, filters common webpage noise, and writes only
source-backed filling norms.

## Ingestion

Run from `viza-be/agent-backend`:

```bash
npm run ingest:all-visa-rag
npm run ingest:country-visa-rag -- --country japan
npm run ingest:country-visa-rag -- --countries japan,us,indonesia
npm run ingest:photo-requirements-rag
```

The ingestion writes all chunks to the shared `visa_documents` and `visa_chunks` tables. The files are independent source assets; the runtime RAG store remains shared so retrieval can still search across countries when a user asks a multi-destination question.

`ingest:photo-requirements-rag` crawls the official source URLs in the country seeds plus curated official photo-specification pages, then writes `documentType: "photo_requirements"` chunks for field-level upload guidance. Use `--dry-run` to verify crawl coverage without writing to Supabase, or `--countries us,uk,france` to limit the ingest.

## Rules

- One country per file.
- Every document in a file must have `country` equal to the file's `country`.
- Chunk IDs must be unique inside each country file.
- Keep one `form_requirements` document per country + `visaType`. Replace it
  when updating that product's form requirements; do not append duplicates for
  the same product.
- Ingestion always targets a staged release. Run the promotion command only
  after source, metadata, chunk, embedding and regression gates pass:
  `npm run promote:visa-rag -- <release-key>`.
- Prefer official government, embassy, immigration, or authorized visa-centre sources.
- When adding a major country workflow file or seed, update this README, `docs/viza-ai-chat-development-guide.md`, and `viza-fe/internal-website/app/client/chat/AGENTS.md`.

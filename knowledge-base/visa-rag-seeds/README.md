# Country Visa RAG Seeds

This directory is the source of truth for country-level visa RAG knowledge.
Inventory and implementation baseline: **2026-09-13**, not a live database audit.

Each file in `countries/*.json` owns one country's visitor/tourism visa knowledge and should evolve with that country's dedicated form-filling workflow. Keep country-specific rules, official source URLs, application-route notes, form-intake context, and future form-flow context in the same country seed instead of adding a shared multi-country seed.

The current repository inventory is 61 country files, 159 documents and 559
chunks, including 70 `form_requirements` documents. The backend destination
registry also has 61 entries, but only 56 are in `VISA_SERVICE_COUNTRIES`.
`mexico`, `morocco`, `nepal`, `qatar`, and `russia` have seed material but are
dormant reference destinations until the product registry opens them. Counts
describe checked-in seed files, not a deployed Supabase database.

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
- South Korea: `KR_C39_SHORT_TERM_VISIT`, `KR_E_ARRIVAL_CARD` (K-ETA remains an external travel-authorisation route)
- United States: `DS160`
- Schengen destinations: `EU_SCHENGEN_C_SHORT_STAY`
- Philippines: `PH_TEMPORARY_VISITOR_VISA`, `PH_ETRAVEL_ARRIVAL_CARD`, `PH_ETRAVEL_DEPARTURE_CARD`
- United Kingdom: `UK_STANDARD_VISITOR`
- Taiwan: `TW_ENTRY_PERMIT`
- Japan: `short_term_tourism_evisa`, `JP_VISIT_JAPAN_WEB` (Visit Japan Web immigration/customs declaration;
  live third-party automation remains gated on current Digital Agency terms and
  authorization)
- Kenya: `KE_ETA` (official electronic travel authorisation; standard official
  fee baseline USD 30; no F88 product)

The complete country and product matrix, aliases and default visitor products
live in `viza-be/agent-backend/src/config/visa-destination-registry.ts`; this
README's list is a product summary and must not become a second registry.

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

Each `form_requirements` document should carry the shared
`standard_passport_identity_field_rules` chunk. In the current checked-in
inventory, this chunk exists in 59 of the 70 form documents; missing documents
need to be completed before claiming full field-guidance coverage. The backend
field-guidance route also injects a code-level standard identity context, so
the seed chunk supplements a deterministic rule rather than being its only
source. The rule covers passport issuing authority, place of issue, passport
type, nationality, passport dates, and other identity fields that must come
from the passport, official identity document, MRZ, or official dropdown
options. It treats issuing country, place of issue, and issuing authority as
distinct fields; authority names must never be used as place-of-issue examples.

Country seeds may also carry an `official_field_answer_norms` chunk inside the
same `form_requirements` document. Generate or refresh this chunk with
`npm run enrich:field-answer-norms-rag` from `viza-be/agent-backend`; the script
crawls the official or authorized URLs already present in the seed, extracts
field-answer evidence, filters common webpage noise, and writes only
source-backed filling norms. It fetches at most 10 URLs per country, keeps
sentences of 45..900 characters, and writes at most three 360-character
snippets per topic; there is no overlap-based or token-based chunker. The
current inventory has this optional chunk in 54 form documents.

## Ingestion

Run from `viza-be/agent-backend`:

```bash
npm run ingest:all-visa-rag
npm run ingest:country-visa-rag -- --country japan
npm run ingest:country-visa-rag -- --countries japan,us,indonesia
npm run enrich:field-answer-norms-rag -- --countries japan,us,indonesia
npm run ingest:photo-requirements-rag
npm run stage:visa-rag-supplements -- <release-key>
npm run promote:visa-rag -- <release-key>
```

`ingest:all-visa-rag` and the country-specific variants read only the JSON
seeds and write their supplied chunks to a staged release in the shared
`visa_documents` and `visa_chunks` tables. They do not fetch URLs, parse PDFs,
or run FAQ ingestion. There is no generic chunk size or overlap: source chunks
are preserved, and the embedding request truncates each input to 8,000
characters. Embeddings use `text-embedding-3-small` with 1536 dimensions; the
country ingestion allows four total attempts per chunk (initial call plus
three retries), with a 30-second timeout per attempt and 1s/2s/4s backoff.
The release promotion function requires complete metadata, chunks, embeddings,
official-source reachability, and configured entry-rule coverage before an
active release can be selected.

The runtime RAG store remains shared so retrieval can still search across
countries when a user asks a multi-destination question, while country and
visa-type filters constrain normal single-destination retrieval.

`ingest:photo-requirements-rag` is a separate legacy supplement path. It
crawls official HTML URLs, extracts at most five photo excerpts per country
with each excerpt truncated to 700 characters, and skips PDFs with
`pdf_not_parsed`; it does not use overlap chunking and is not invoked by the
country seed command. Use `--dry-run` to verify crawl coverage without writing
to Supabase, or `--countries us,uk,france` to limit the ingest. The package
still advertises `ingest:faqs`, but `scripts/ingest-faqs.ts` is absent in the
current repository, so that command is not an available ingestion path.

The standalone `scripts/ingest-ds160-rag.ts` file is a separate legacy script,
and the current package scripts do not expose an `ingest:ds160-rag` command. It
reads Markdown from an external DS-160 Vault path, splits `RAG_CHUNKS.md` on
the literal newline + `---` + newline separator, and stores `APPLICATION_FLOW.md` as one full chunk. It has no fixed
chunk size or overlap and is not used by the country seed commands; it is not a
generic PDF, URL, or FAQ ingestion pipeline.

## Rules

Retrieval parameters and splitting candidates are evaluated in
[the reproducible RAG study](../../viza-be/agent-backend/evals/README.md).
Country ingestion defaults to `seed-semantic`. `--chunking` accepts the tested
400/800/1600 Unicode-character profiles with zero or 20% overlap, for example:

```powershell
npm run ingest:country-visa-rag -- --country japan --dry-run --chunking chars-400-overlap-0
```

The dry run prints the projected chunk count without provider calls or writes.
Actual splitting needs a new staged release and fresh embeddings; changing only
retrieval parameters does not repartition existing database rows. A higher dev
score does not authorize promoting a failed heldout candidate.

- One country per file.
- Every document in a file must have `country` equal to the file's `country`.
- Chunk IDs must be unique inside each country file.
- Keep one `form_requirements` document per country + `visaType`. Replace it
  when updating that product's form requirements; do not append duplicates for
  the same product.
- Country JSON ingestion targets a staged release. Legacy photo supplements
  use their separate ingestion/staging path described above. Run promotion only
  after source, metadata, chunk, embedding and regression gates pass:
  `npm run promote:visa-rag -- <release-key>`.
- Prefer official government, embassy, immigration, or authorized visa-centre sources.
- When adding a major country workflow file or seed, update this README, `docs/viza-ai-chat-development-guide.md`, and `viza-fe/internal-website/app/client/chat/AGENTS.md`.

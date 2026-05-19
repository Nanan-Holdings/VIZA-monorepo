# Country Visa RAG Seeds

This directory is the source of truth for country-level visa RAG knowledge.

Each file in `countries/*.json` owns one country's visitor/tourism visa knowledge and should evolve with that country's dedicated form-filling workflow. Keep country-specific rules, official source URLs, application-route notes, form-intake context, and future form-flow context in the same country seed instead of adding a shared multi-country seed.

Every country seed should include exactly one `documentType: "form_requirements"` document. This document is the bridge between RAG and future form automation: it describes the official application channel, the form fields VIZA should collect before filling, the supporting documents/uploads to prepare, and review/submission guardrails.

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
- Keep one `form_requirements` document per country. Replace it when updating form requirements; do not append duplicates.
- Prefer official government, embassy, immigration, or authorized visa-centre sources.
- When adding a major country workflow file or seed, update this README, `docs/viza-ai-chat-development-guide.md`, and `viza-fe/internal-website/app/client/chat/AGENTS.md`.

# Visa RAG Seeds Agent Guide

Scope: this file applies to `knowledge-base/visa-rag-seeds/**`.

## Purpose

Country RAG seeds are the source assets for VIZA visa knowledge. They feed the
shared runtime tables `visa_documents` and `visa_chunks` used by VIZA AI,
field guidance, and future form automation.

## Key Flow

1. Edit or add one country file in `countries/*.json`.
2. Keep source URLs official or authorized where possible.
3. Include exactly one `documentType: "form_requirements"` document per country.
4. Run ingestion from `viza-be/agent-backend`.
5. Verify chat/RAG behavior for that country.

## Ownership Boundaries

- One country per file.
- Every document in a file must match that file's `country`.
- Chunk IDs must be unique inside the country file.
- Do not append duplicate `form_requirements` documents; replace/update the
  existing one.
- Do not invent requirements. Mark unknown or country-variant details clearly.
- If a country becomes form-fillable, update frontend destination metadata,
  backend destination registry, docs, and relevant module AGENTS files.

## Validation

Run from `viza-be/agent-backend`:

```powershell
npm run ingest:country-visa-rag -- --country japan
npm run ingest:country-visa-rag -- --countries japan,us,indonesia
npm run ingest:all-visa-rag
npm run ingest:photo-requirements-rag
```

Then smoke VIZA AI with a country-specific prompt and, when relevant, field
guidance for a form field.

## Related Files

- `knowledge-base/visa-rag-seeds/README.md`
- `knowledge-base/visa-rag-seeds/countries/*.json`
- `viza-be/agent-backend/scripts/ingest-country-visa-rag.ts`
- `viza-be/agent-backend/scripts/ingest-photo-requirements-rag.ts`
- `viza-be/agent-backend/src/services/visa-knowledge.service.ts`
- `viza-be/agent-backend/src/config/visa-destination-registry.ts`
- `docs/viza-ai-chat-development-guide.md`
- `docs/application/DG.md`

# Knowledge Base Agent Guide

Scope: this file applies to `knowledge-base/**`.

## Purpose

`knowledge-base` contains source assets and scripts for visa knowledge used by
the RAG layer. Country-level visa seeds under `visa-rag-seeds` are the active
source for supported visitor/tourism knowledge.

## Key Components

- `visa-rag-seeds/README.md`: seed rules and ingestion commands.
- `visa-rag-seeds/countries/*.json`: one JSON source file per country.
- `package.json`: knowledge-base package metadata/scripts if used.

## Ownership Boundaries

- Keep official/authorized source URLs with the country seed they support.
- Do not edit runtime `visa_documents`/`visa_chunks` directly from this
  directory; use agent-backend ingestion scripts.
- Major country seed changes should be reflected in chat/application docs and
  relevant AGENTS files.

## Validation

Use structured JSON validation and then ingest from `viza-be/agent-backend` when
runtime updates are needed:

```powershell
cd viza-be\agent-backend
npm run ingest:country-visa-rag -- --country japan
npm run ingest:all-visa-rag
```

## Related Files

- `knowledge-base/visa-rag-seeds/AGENTS.md`
- `viza-be/agent-backend/scripts/ingest-country-visa-rag.ts`
- `viza-be/agent-backend/src/services/visa-knowledge.service.ts`
- `viza-be/agent-backend/src/config/visa-destination-registry.ts`

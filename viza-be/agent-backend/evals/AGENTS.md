# RAG Retrieval Evaluation Sets

Scope: this file applies to `viza-be/agent-backend/evals/**`.

## Purpose

This directory contains small, source-grounded evaluation data for tuning and
regressing the VIZA visa-knowledge retriever. The query set is agent-curated
synthetic data from the checked-in country seed JSON files. It is not a sample of production
traffic and must not be described as user-labeled data.

## Files

- `rag-retrieval-queries.json`: original 72 questions, partitioned into 42 dev
  and 30 heldout cases for round one.
- `rag-retrieval-results.json`: full round-one report, including the rejected
  candidates. Keep failures visible rather than overwriting them with later wins.
- `rag-retrieval-confirmation-queries.json`: fresh confirmation questions with
  source parents disjoint from the original positive labels.
- `rag-retrieval-confirmation-results.json`: round two, which explicitly uses
  all original 72 cases as development data and only the new set as heldout.
- `rag-retrieval-robust-queries.json`: final 20 independent questions, with
  source parents and query text disjoint from earlier positive/test examples.
- `rag-retrieval-robust-results.json`: final conservative study, using 102 dev
  questions, preserving seed boundaries and checking parameter margin. This
  candidate also failed; do not present the retained defaults as an optimum.
- `README.md`: experiment findings, implementation decision, and reproduction.
- `rag-retrieval-optimality-certificate.json`: exhaustive empirical search over
  all 122 previously seen questions, seven fixed chunkings, k 1-12 and every
  threshold equivalence interval in [0,1]. It records exact rational objective
  values, ties, per-k optima, hashes, and compression parity checks.
- `rag-retrieval-optimality.md`: scope and proof of that finite-benchmark claim,
  comparison method, measured results and production/generalization limits.

## Gold-label rules

- `relevantChunkIds` and `evidence[].chunkId` use the original
  `documents[].chunks[].id` values from
  `knowledge-base/visa-rag-seeds/countries/*.json`, not runtime UUIDs.
- Every positive evidence `text` must be an exact substring of the referenced
  seed chunk's `content`. Keep it to one or two sentences that directly
  support the query; include every necessary chunk for a multi-intent query.
- `answerable: false` means the checked-in knowledge base cannot answer the
  specific requested information under the item's effective country, visa type,
  and document-type filters. A chunk that directly supports a useful scope
  refusal should not automatically be labeled irrelevant. Such negative items
  use an empty relevant-ID list and explain the negative basis in `rationale`.
- Keep parent chunks in one split where possible. A source chunk must not be
  reused across `dev` and `heldout` for a positive case. IDs may repeat across
  countries; validate the country-scoped parent and runtime-normalized filters.
- Include both English and Chinese queries, exact questions and paraphrases,
  multi-intent questions, and filter-aware negatives across several countries
  and document types.

## Editing and validation

The JSON file is data-only. Do not call an LLM, access Supabase, read an env
file, or browse the network to create or validate labels. When a seed changes,
recheck all referenced IDs and evidence substrings locally before updating the
dataset. Keep `heldout` cases out of parameter selection; use them only for
the final comparison after a configuration is chosen on `dev`.

The separate optimality certificate intentionally pools all three already seen
sets for descriptive optimization. It must label them as seen benchmark data,
never new heldout validation, and must not overwrite historical split files or
use its result alone to promote a runtime configuration.

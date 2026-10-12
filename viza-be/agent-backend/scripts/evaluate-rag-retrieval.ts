/** Public seed retrieval experiment. No database reads/writes or answer-generation calls. */
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import { documentTypesForIntent, normalizeKnowledgeFilters } from '../src/services/visa-knowledge-query.js';
import {
  buildKnowledgeChunkContent, buildKnowledgeEmbeddingText, splitKnowledgeChunk,
  KNOWLEDGE_CHUNKING_CANDIDATES,
  type ChunkingPolicy, type KnowledgeChunkInput, type KnowledgeDocumentMetadata,
} from '../src/services/visa-knowledge-chunking.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEEDS = resolve(ROOT, '../../knowledge-base/visa-rag-seeds/countries');
const MODEL = 'text-embedding-3-small';
const DIMENSIONS = 1536;
const CACHE = resolve(ROOT, '.tmp/rag-eval/embeddings.json');
const RESULTS = resolve(ROOT, 'evals/rag-retrieval-results.json');
const DATASET = resolve(ROOT, 'evals/rag-retrieval-queries.json');
const CONFIRMATION_DATASET = resolve(ROOT, 'evals/rag-retrieval-confirmation-queries.json');
const CONFIRMATION_RESULTS = resolve(ROOT, 'evals/rag-retrieval-confirmation-results.json');
const ROBUST_DATASET = resolve(ROOT, 'evals/rag-retrieval-robust-queries.json');
const ROBUST_RESULTS = resolve(ROOT, 'evals/rag-retrieval-robust-results.json');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export interface EvalQuery {
  id: string; split: 'dev' | 'heldout'; query: string;
  country?: string; visaType?: string; documentTypes?: string[];
  intent?: 'route_recommendation' | 'requirements' | 'form_intake' | 'fees_timing' | 'eligibility' | 'source_check';
  relevantChunkIds: string[]; answerable: boolean; rationale: string;
  evidence: Array<{ chunkId: string; text: string }>;
}
interface Document extends KnowledgeDocumentMetadata { slug: string; chunks: KnowledgeChunkInput[] }
export interface CorpusChunk {
  id: string; parentId: string; country: string; visaType: string; documentType: string;
  content: string; embeddingText: string; parentContent: string; sourceStart: number; sourceEnd: number;
}
export interface Candidate { chunking: string; matchCount: number; minSimilarity: number }
interface RankedChunk { chunk: CorpusChunk; similarity: number }
export interface QueryScore {
  id: string; answerable: boolean; recall: number; precision: number; f2: number;
  reciprocalRank: number; abstained: boolean; contextChars: number;
  retrieved: Array<{ id: string; parentId: string; similarity: number; relevant: boolean }>;
}
export interface Metrics {
  queries: number; positives: number; negatives: number;
  recall: number; precision: number; f2: number; mrr: number;
  negativeFalsePositiveRate: number; meanContextChars: number; objective: number;
}
const CHUNKING = KNOWLEDGE_CHUNKING_CANDIDATES;
const COUNTS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const THRESHOLDS = [0, 0.03, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7];

export function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) throw new Error('Invalid vector dimensions');
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  if (!aa || !bb || !Number.isFinite(dot + aa + bb)) throw new Error('Invalid vector values');
  return dot / Math.sqrt(aa * bb);
}

export function validateQueries(queries: EvalQuery[], corpus: CorpusChunk[]): void {
  const ids = new Set<string>();
  const splitByParent = new Map<string, string>();
  const splitByText = new Map<string, string>();
  for (const q of queries) {
    const filters = normalizeKnowledgeFilters(q);
    if (ids.has(q.id)) throw new Error(`Duplicate query ID: ${q.id}`);
    ids.add(q.id);
    if (!['dev', 'heldout'].includes(q.split) || !q.query.trim() || !q.rationale.trim()) throw new Error(`Invalid query: ${q.id}`);
    const queryKey = q.query.trim().toLowerCase().replace(/\s+/g, ' ');
    if (splitByText.has(queryKey) && splitByText.get(queryKey) !== q.split) throw new Error(`Query text leaks across splits: ${q.id}`);
    splitByText.set(queryKey, q.split);
    if (q.answerable !== (q.evidence.length > 0) || q.answerable !== (q.relevantChunkIds.length > 0)) throw new Error(`Inconsistent labels: ${q.id}`);
    if (new Set(q.relevantChunkIds).size !== q.relevantChunkIds.length) throw new Error(`Duplicate gold ID: ${q.id}`);
    const scopedSources = new Map<string, CorpusChunk>();
    for (const id of q.relevantChunkIds) {
      const sources = corpus.filter(c => c.parentId === id && (!filters.country || c.country === filters.country)
        && (!filters.visaType || c.visaType === filters.visaType)
        && (!q.documentTypes?.length || q.documentTypes.includes(c.documentType)));
      if (sources.length !== 1) throw new Error(`Gold excluded or ambiguous after metadata: ${q.id}/${id}`);
      const source = sources[0];
      scopedSources.set(id, source);
      if (!q.evidence.some(e => e.chunkId === id)) throw new Error(`Missing evidence: ${q.id}/${id}`);
      const parentKey = `${source.country}/${id}`;
      if (splitByParent.has(parentKey) && splitByParent.get(parentKey) !== q.split) throw new Error(`Gold parent leaks across splits: ${parentKey}`);
      splitByParent.set(parentKey, q.split);
    }
    for (const evidence of q.evidence) {
      if (!q.relevantChunkIds.includes(evidence.chunkId) || !evidence.text.trim()
        || !scopedSources.get(evidence.chunkId)?.parentContent.includes(evidence.text)) throw new Error(`Evidence not in seed: ${q.id}`);
    }
  }
  for (const split of ['dev', 'heldout']) for (const answerable of [true, false]) {
    if (!queries.some(q => q.split === split && q.answerable === answerable)) throw new Error(`Missing ${split} ${answerable} cases`);
  }
}

export function selectChunks(q: EvalQuery, ranked: RankedChunk[], candidate: Candidate): RankedChunk[] {
  const filters = normalizeKnowledgeFilters(q);
  const eligible = ranked.filter(({ chunk, similarity }) => similarity >= candidate.minSimilarity
    && (!filters.country || chunk.country === filters.country) && (!filters.visaType || chunk.visaType === filters.visaType));
  const explicit = Boolean(q.documentTypes?.length);
  const types = explicit ? q.documentTypes : documentTypesForIntent(q.intent);
  const filtered = types ? eligible.filter(({ chunk }) => types.includes(chunk.documentType)) : eligible;
  // Runtime broadening applies only to implicit intent filters, never explicit filters.
  return (filtered.length || explicit ? filtered : eligible).slice(0, candidate.matchCount);
}

export function scoreQuery(q: EvalQuery, selected: RankedChunk[]): QueryScore {
  const key = (chunk: CorpusChunk) => `${chunk.country}/${chunk.parentId}`;
  const sources = new Map<string, CorpusChunk[]>();
  for (const { chunk } of selected) sources.set(key(chunk), [...(sources.get(key(chunk)) ?? []), chunk]);
  const covers = (pieces: CorpusChunk[], evidence: EvalQuery['evidence'][number]) => {
    if (pieces[0].parentId !== evidence.chunkId) return false;
    const start = pieces[0].parentContent.indexOf(evidence.text);
    if (start < 0) return false;
    const end = start + evidence.text.length;
    let coveredTo = start;
    for (const piece of [...pieces].sort((a, b) => a.sourceStart - b.sourceStart)) {
      if (piece.sourceEnd <= coveredTo) continue;
      if (piece.sourceStart > coveredTo) break;
      coveredTo = piece.sourceEnd;
      if (coveredTo >= end) return true;
    }
    return false;
  };
  const relevantSources = new Set([...sources].filter(([, pieces]) => q.evidence.some(e => covers(pieces, e))).map(([id]) => id));
  const relevant = ({ chunk }: RankedChunk) => relevantSources.has(key(chunk));
  const hitEvidence = q.evidence.filter(e => [...sources.values()].some(pieces => covers(pieces, e))).length;
  const recall = q.evidence.length ? hitEvidence / q.evidence.length : 0;
  // Source-level precision avoids giving duplicate overlap pieces extra positive votes.
  const precision = sources.size ? relevantSources.size / sources.size : 0;
  const first = selected.findIndex(relevant);
  return {
    id: q.id, answerable: q.answerable, recall, precision,
    f2: precision + recall ? 5 * precision * recall / (4 * precision + recall) : 0,
    reciprocalRank: first < 0 ? 0 : 1 / (first + 1), abstained: selected.length === 0,
    contextChars: selected.reduce((sum, { chunk }) => sum + chunk.content.length, 0),
    retrieved: selected.map(r => ({ id: r.chunk.id, parentId: r.chunk.parentId, similarity: r.similarity, relevant: relevant(r) })),
  };
}
export function aggregate(scores: QueryScore[]): Metrics {
  const positives = scores.filter(s => s.answerable), negatives = scores.filter(s => !s.answerable);
  const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
  const f2 = average(positives.map(s => s.f2));
  const negativeFalsePositiveRate = average(negatives.map(s => Number(!s.abstained)));
  return {
    queries: scores.length, positives: positives.length, negatives: negatives.length,
    recall: average(positives.map(s => s.recall)), precision: average(positives.map(s => s.precision)),
    f2, mrr: average(positives.map(s => s.reciprocalRank)), negativeFalsePositiveRate,
    meanContextChars: average(scores.map(s => s.contextChars)),
    objective: 0.7 * f2 + 0.3 * (1 - negativeFalsePositiveRate),
  };
}

export function pairedBootstrap(baseline: QueryScore[], candidate: QueryScore[]): Record<string, { delta: number; low95: number; high95: number }> {
  if (baseline.length !== candidate.length || baseline.some((q, i) => q.id !== candidate[i].id)) throw new Error('Bootstrap pairs must align');
  let state = 20260914;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
  const interval = (deltas: number[]) => {
    const draws = Array.from({ length: 5000 }, () => {
      let sum = 0; for (let i = 0; i < deltas.length; i++) sum += deltas[Math.floor(random() * deltas.length)];
      return sum / deltas.length;
    }).sort((a, b) => a - b);
    return { delta: deltas.reduce((a, b) => a + b, 0) / deltas.length, low95: draws[125], high95: draws[4874] };
  };
  const positive = baseline.flatMap((q, i) => q.answerable ? [i] : []);
  const negative = baseline.flatMap((q, i) => !q.answerable ? [i] : []);
  return {
    f2: interval(positive.map(i => candidate[i].f2 - baseline[i].f2)),
    recall: interval(positive.map(i => candidate[i].recall - baseline[i].recall)),
    negativeFalsePositiveRate: interval(negative.map(i => Number(!candidate[i].abstained) - Number(!baseline[i].abstained))),
  };
}

export function readCorpus(policy: ChunkingPolicy | null): CorpusChunk[] {
  return readdirSync(SEEDS).filter(f => f.endsWith('.json')).sort().flatMap(f => {
    const seed = JSON.parse(readFileSync(resolve(SEEDS, f), 'utf8')) as { documents: Document[] };
    return seed.documents.flatMap(doc => doc.chunks.flatMap(parent => {
      let cursor = 0;
      const points = Array.from(parent.content);
      return splitKnowledgeChunk(parent, policy).map(chunk => {
        const sourceStart = points.slice(0, cursor).join('').length;
        cursor += Array.from(chunk.content).length - (policy?.overlapChars ?? 0);
        return {
          id: `${doc.country}/${chunk.id}`, parentId: parent.id, country: doc.country, visaType: doc.visaType, documentType: doc.documentType,
          content: buildKnowledgeChunkContent(doc, chunk), embeddingText: buildKnowledgeEmbeddingText(doc, chunk),
          parentContent: parent.content, sourceStart, sourceEnd: sourceStart + chunk.content.length,
        };
      });
    }));
  });
}
interface EmbeddingReceipt { at: string; inputs: number; tokens: number; milliseconds: number }
interface EmbeddingCache { model: string; dimensions: number; vectors: Record<string, number[]>; receipts: EmbeddingReceipt[] }
async function withExperimentLock<T>(work: () => Promise<T>): Promise<T> {
  const lockPath = resolve(dirname(CACHE), 'run.lock');
  mkdirSync(dirname(lockPath), { recursive: true });
  let lock: number;
  try { lock = openSync(lockPath, 'wx'); }
  catch { throw new Error('RAG experiment lock unavailable. Do not run concurrent evaluations; remove a stale .tmp/rag-eval/run.lock only after verifying the previous process stopped.'); }
  try { return await work(); }
  finally { closeSync(lock); unlinkSync(lockPath); }
}
function saveJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, JSON.stringify(value, null, path === CACHE ? undefined : 2) + '\n');
  renameSync(`${path}.tmp`, path);
}
async function embed(texts: string[], live: boolean): Promise<EmbeddingCache> {
  const cache: EmbeddingCache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) as EmbeddingCache
    : { model: MODEL, dimensions: DIMENSIONS, vectors: {}, receipts: [] };
  if (cache.model !== MODEL || cache.dimensions !== DIMENSIONS) throw new Error('Incompatible embedding cache');
  for (const text of new Set(texts)) {
    const vector = cache.vectors[hash(text)];
    if (vector && (!Array.isArray(vector) || vector.length !== DIMENSIONS || !vector.every(Number.isFinite)
      || !vector.some(value => value !== 0))) throw new Error('Invalid cached embedding; remove the local cache and rerun');
  }
  const missing = [...new Set(texts)].filter(t => !cache.vectors[hash(t)]);
  console.log(JSON.stringify({ uniqueInputs: new Set(texts).size, missingEmbeddings: missing.length }));
  if (missing.length && !live) throw new Error('Cache incomplete. Use --live to embed PUBLIC repository seeds and synthetic queries.');
  if (missing.length > 10000 || missing.reduce((s, t) => s + t.length, 0) > 8_000_000) throw new Error('Experiment input budget exceeded');
  if (missing.length) {
    dotenv.config({ path: resolve(ROOT, '.env.local') }); dotenv.config({ path: resolve(ROOT, '.env') });
    if (!process.env.OPENAI_API_KEY || /your[_-]/i.test(process.env.OPENAI_API_KEY)) throw new Error('OPENAI_API_KEY unavailable');
  }
  for (let start = 0; start < missing.length; start += 32) {
    const batch = missing.slice(start, start + 32);
    let complete = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const began = performance.now();
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: MODEL, input: batch, dimensions: DIMENSIONS }), signal: AbortSignal.timeout(40_000),
      });
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * 2 ** attempt)); continue;
        }
        throw new Error(`Embedding HTTP ${response.status}; provider response omitted`);
      }
      const body = await response.json() as { data: Array<{ index: number; embedding: number[] }>; usage: { total_tokens: number } };
      if (!Array.isArray(body.data) || body.data.length !== batch.length || new Set(body.data.map(d => d.index)).size !== batch.length) throw new Error('Incomplete embedding batch');
      if (!Number.isSafeInteger(body.usage?.total_tokens) || body.usage.total_tokens < 0) throw new Error('Invalid provider usage receipt');
      for (const item of body.data) {
        if (!batch[item.index] || !Array.isArray(item.embedding) || item.embedding.length !== DIMENSIONS || !item.embedding.every(Number.isFinite)
          || !item.embedding.some(value => value !== 0)) throw new Error('Invalid embedding response');
        cache.vectors[hash(batch[item.index])] = item.embedding;
      }
      cache.receipts.push({ at: new Date().toISOString(), inputs: batch.length, tokens: body.usage.total_tokens, milliseconds: performance.now() - began });
      saveJson(CACHE, cache);
      console.log(`Embedded ${Math.min(start + 32, missing.length)}/${missing.length}`);
      complete = true; break;
    }
    if (!complete) throw new Error('Embedding retries exhausted');
  }
  return cache;
}

export async function runExperiment(live: boolean, confirmation = false, robust = false): Promise<void> {
  let datasetText = readFileSync(DATASET, 'utf8');
  const dataset = JSON.parse(datasetText) as { provenance: unknown; queries: EvalQuery[] };
  if (dataset.queries.length !== 72) throw new Error('This versioned experiment requires the complete 72-question original set');
  if (confirmation || robust) {
    const confirmationText = readFileSync(CONFIRMATION_DATASET, 'utf8');
    const fresh = JSON.parse(confirmationText) as { provenance: unknown; queries: EvalQuery[] };
    if (fresh.queries.length !== 30) throw new Error('This versioned experiment requires 30 confirmation questions');
    if (fresh.queries.some(q => q.split !== 'heldout')) throw new Error('Confirmation questions must all be heldout');
    dataset.queries = [...dataset.queries.map(q => ({ ...q, split: 'dev' as const })), ...fresh.queries];
    dataset.provenance = { development: dataset.provenance, confirmation: fresh.provenance,
      note: 'After round-one rejection, all 72 old questions are development data. Only the newly authored disjoint confirmation set is heldout.' };
    datasetText += '\n' + confirmationText;
  }
  if (robust) {
    const robustText = readFileSync(ROBUST_DATASET, 'utf8');
    const fresh = JSON.parse(robustText) as { provenance: unknown; queries: EvalQuery[] };
    if (fresh.queries.length !== 20) throw new Error('This versioned experiment requires 20 robust confirmation questions');
    if (fresh.queries.some(q => q.split !== 'heldout')) throw new Error('Robust confirmation questions must all be heldout');
    dataset.queries = [...dataset.queries.map(q => ({ ...q, split: 'dev' as const })), ...fresh.queries];
    dataset.provenance = { development: dataset.provenance, finalConfirmation: fresh.provenance,
      note: 'Both earlier sets (102 questions) are development data. Only the new robust set is heldout. Preserve seed boundaries; require retrieval-parameter margin on development data.' };
    datasetText += '\n' + robustText;
  }
  const resultPath = robust ? ROBUST_RESULTS : confirmation ? CONFIRMATION_RESULTS : RESULTS;
  const recallTolerance = confirmation || robust ? 0 : 0.02;
  const chunkings = robust ? CHUNKING.filter(c => c.name === 'seed-semantic') : CHUNKING;
  const corpora = new Map(chunkings.map(c => [c.name, readCorpus(c.policy)]));
  const original = corpora.get('seed-semantic')!;
  validateQueries(dataset.queries, original);
  const inputs = [...corpora.values()].flat().map(c => c.embeddingText).concat(dataset.queries.map(q => q.query.trim().slice(0, 8000)));
  const cache = await embed(inputs, live);
  const embeddingDigest = createHash('sha256');
  for (const key of [...new Set(inputs.map(hash))].sort()) embeddingDigest.update(key).update(JSON.stringify(cache.vectors[key]));
  const ranked = new Map<string, RankedChunk[]>();
  const start = performance.now();
  for (const [name, corpus] of corpora) for (const query of dataset.queries) {
    const filters = normalizeKnowledgeFilters(query);
    const vector = cache.vectors[hash(query.query.trim().slice(0, 8000))];
    ranked.set(`${name}/${query.id}`, corpus.filter(c => (!filters.country || c.country === filters.country)
      && (!filters.visaType || c.visaType === filters.visaType)).map(chunk => ({ chunk, similarity: cosine(vector, cache.vectors[hash(chunk.embeddingText)]) }))
      .sort((a, b) => b.similarity - a.similarity || a.chunk.id.localeCompare(b.chunk.id)));
  }
  const rankingMs = performance.now() - start;
  const evaluate = (candidate: Candidate, split: 'dev' | 'heldout') => {
    const scores = dataset.queries.filter(q => q.split === split).map(q => scoreQuery(q, selectChunks(q, ranked.get(`${candidate.chunking}/${q.id}`)!, candidate)));
    return { candidate, metrics: aggregate(scores), scores };
  };
  const baseline: Candidate = { chunking: 'seed-semantic', matchCount: 5, minSimilarity: 0.03 };
  const baselineDev = evaluate(baseline, 'dev');
  const candidates = chunkings.flatMap(c => COUNTS.flatMap(matchCount => THRESHOLDS.map(minSimilarity => ({ chunking: c.name, matchCount, minSimilarity }))));
  // Selection is frozen on dev. Heldout is only opened AFTER choosing these candidates.
  const leaderboard = candidates.map(candidate => {
    const evaluated = evaluate(candidate, 'dev');
    const marginMetrics = robust ? evaluate({ ...candidate, matchCount: Math.max(1, candidate.matchCount - 1),
      minSimilarity: Math.min(1, Number((candidate.minSimilarity + 0.05).toFixed(2))) }, 'dev').metrics : null;
    return { candidate, metrics: evaluated.metrics, marginMetrics };
  }).filter(row => row.metrics.recall >= baselineDev.metrics.recall - recallTolerance)
    .filter(row => !row.marginMetrics || row.marginMetrics.recall >= 1)
    .sort((a, b) => b.metrics.objective - a.metrics.objective || a.metrics.meanContextChars - b.metrics.meanContextChars
      || a.candidate.matchCount - b.candidate.matchCount || a.candidate.minSimilarity - b.candidate.minSimilarity);
  if (!leaderboard.length) throw new Error('No candidate met recall floor');
  const winner = leaderboard[0].candidate;
  const compatibleWinner = leaderboard.find(r => r.candidate.chunking === 'seed-semantic')!.candidate;
  const baselineHeldout = evaluate(baseline, 'heldout');
  const winnerHeldout = evaluate(winner, 'heldout');
  const compatibleHeldout = evaluate(compatibleWinner, 'heldout');
  const gate = (m: Metrics) => ({
    passed: m.recall >= baselineHeldout.metrics.recall - recallTolerance && m.f2 >= baselineHeldout.metrics.f2
      && m.negativeFalsePositiveRate <= baselineHeldout.metrics.negativeFalsePositiveRate,
    rule: `heldout recall >= baseline - ${recallTolerance}; F2 >= baseline; negative false-positive rate <= baseline`,
  });
  const result = {
    schemaVersion: 1, round: robust ? 3 : confirmation ? 2 : 1, generatedAt: new Date().toISOString(), model: MODEL, dimensions: DIMENSIONS,
    datasetSha256: hash(datasetText), seedSha256: hash(JSON.stringify(original)), embeddingSha256: embeddingDigest.digest('hex'), provenance: dataset.provenance,
    scope: 'Exact local cosine search over checked-in public country seeds; not the active DB, ANN index, live user traffic, or end-to-end answer quality.',
    baselineScope: 'Old vector parameters only; legacy unordered REST fallback is excluded and separately regression-tested.',
    selectionRule: `dev recall >= baseline - ${recallTolerance}; maximize 0.7 * positive macro F2 + 0.3 * negative abstention; ties: fewer context chars, then smaller k, then lower threshold. Heldout never reselects.`,
    parameterMarginRule: robust ? 'Preserve seed boundaries. Also require full development recall when k is reduced by 1 and threshold increased by 0.05; this is an explicit conservative policy, not a measured universal constant.' : null,
    chunkingUnit: 'Unicode code points in seed content; production metadata retained per piece. Evidence spans must be fully covered by the union of retrieved source intervals; gaps do not count. Precision deduplicates parent sources, not overlap pieces.',
    precisionDefinition: 'Parent-source precision, not per-piece precision: a source is relevant if its retrieved intervals cover at least one complete gold span. Other retrieved pieces of the same source add context cost but no extra precision votes. retrieved[].relevant is source-level.',
    candidateCount: candidates.length, chunking: chunkings.map(c => ({ ...c, chunks: corpora.get(c.name)!.length })),
    embeddingUsage: { batches: cache.receipts.length, inputs: cache.receipts.reduce((s, r) => s + r.inputs, 0), tokens: cache.receipts.reduce((s, r) => s + r.tokens, 0), receipts: cache.receipts },
    embeddingUsageScope: 'Cumulative real provider receipts for this local cache, including preparation. Batch latency is not per-query or end-to-end retrieval latency.',
    localRankingMilliseconds: rankingMs,
    dev: { baseline: baselineDev, winner: evaluate(winner, 'dev'), compatibleWinner: evaluate(compatibleWinner, 'dev'), leaderboard: leaderboard.slice(0, 25),
      bestPerChunking: chunkings.map(c => leaderboard.find(r => r.candidate.chunking === c.name) ?? { chunking: c.name, rejectedByRecallFloor: true }) },
    heldout: { baseline: baselineHeldout, winner: winnerHeldout, compatibleWinner: compatibleHeldout },
    heldoutPairedBootstrap: pairedBootstrap(baselineHeldout.scores, winnerHeldout.scores),
    compatibleHeldoutPairedBootstrap: pairedBootstrap(baselineHeldout.scores, compatibleHeldout.scores),
    promotionGate: gate(winnerHeldout.metrics), compatiblePromotionGate: gate(compatibleHeldout.metrics),
  };
  saveJson(resultPath, result);
  console.log(JSON.stringify({ resultPath, winner, compatibleWinner, heldoutBaseline: baselineHeldout.metrics, heldoutWinner: winnerHeldout.metrics, heldoutCompatible: compatibleHeldout.metrics, promotionGate: result.promotionGate, compatiblePromotionGate: result.compatiblePromotionGate }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--live', '--cached', '--prepare-live', '--confirmation-live', '--confirmation-cached', '--robust-live', '--robust-cached'].includes(arg)) || args.length !== 1) {
    console.error('Usage: npm run eval:rag-retrieval -- --live | --cached | --prepare-live | --confirmation-live | --confirmation-cached | --robust-live | --robust-cached'); process.exitCode = 1;
  } else withExperimentLock<EmbeddingCache | void>(() => args[0] === '--prepare-live'
    ? embed(CHUNKING.flatMap(c => readCorpus(c.policy).map(chunk => chunk.embeddingText)), true)
    : runExperiment(args[0].endsWith('-live') || args[0] === '--live', args[0].startsWith('--confirmation-'), args[0].startsWith('--robust-'))).catch(error => {
    // Only our bounded status errors are expected; never print provider bodies or credentials.
    console.error(error instanceof Error ? error.message : 'RAG experiment failed'); process.exitCode = 1;
  });
}

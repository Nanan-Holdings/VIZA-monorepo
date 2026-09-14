/** Exhaustive empirical certificate, using only frozen local seeds, labels and cached vectors. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aggregate, cosine, readCorpus, scoreQuery, selectChunks, validateQueries,
  type Candidate, type CorpusChunk, type EvalQuery, type Metrics, type QueryScore,
} from './evaluate-rag-retrieval.js';
import { documentTypesForIntent, normalizeKnowledgeFilters } from '../src/services/visa-knowledge-query.js';
import { KNOWLEDGE_CHUNKING_CANDIDATES } from '../src/services/visa-knowledge-chunking.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export interface RankedChunk { chunk: CorpusChunk; similarity: number }
export interface ThresholdInterval { lower: number; lowerInclusive: boolean; upper: number; upperInclusive: true }

/** For k <= maxK, only these two prefixes can ever enter a result. Preserve ranking ties. */
export function compressRanking(q: EvalQuery, ranked: RankedChunk[], maxK: number): RankedChunk[] {
  const filters = normalizeKnowledgeFilters(q);
  const scoped = ranked.filter(({ chunk }) => (!filters.country || chunk.country === filters.country)
    && (!filters.visaType || chunk.visaType === filters.visaType));
  const types = q.documentTypes?.length ? q.documentTypes : documentTypesForIntent(q.intent);
  const filtered = types ? scoped.filter(({ chunk }) => types.includes(chunk.documentType)) : scoped;
  const retained = new Set([...scoped.slice(0, maxK), ...filtered.slice(0, maxK)]);
  return scoped.filter(r => retained.has(r));
}

/** Inclusive >= means each state is represented by the RIGHT endpoint of (a,b]. */
export function thresholdIntervals(rankings: RankedChunk[][]): ThresholdInterval[] {
  const endpoints = [...new Set([0, 1, ...rankings.flatMap(r => r.map(c => c.similarity))
    .filter(s => Number.isFinite(s) && s >= 0 && s <= 1)])].sort((a, b) => a - b);
  return endpoints.map((upper, index) => ({
    lower: index ? endpoints[index - 1] : 0, lowerInclusive: index === 0, upper, upperInclusive: true,
  }));
}

const gcd = (left: bigint, right: bigint): bigint => {
  let a = left, b = right;
  while (b) { const rest = a % b; a = b; b = rest; }
  return a;
};

/** Every F2 denominator is <= 5 * maxK * maxEvidence, so this scale is exact. */
export function objectiveScale(maxK: number, maxEvidence: number): bigint {
  let scale = 1n;
  for (let i = 2n; i <= BigInt(5 * maxK * maxEvidence); i++) scale = scale / gcd(scale, i) * i;
  return scale;
}

export function scaledF2(q: EvalQuery, score: QueryScore, scale: bigint): bigint {
  if (!q.answerable || score.recall === 0) return 0n;
  const sourceKey = (r: QueryScore['retrieved'][number]) => `${r.id.split('/')[0]}/${r.parentId}`;
  const retrieved = new Set(score.retrieved.map(sourceKey)).size;
  const relevant = new Set(score.retrieved.filter(r => r.relevant).map(sourceKey)).size;
  const evidence = q.evidence.length;
  const hits = Math.round(score.recall * evidence);
  const numerator = BigInt(5 * relevant * hits);
  const denominator = BigInt(4 * relevant * evidence + hits * retrieved);
  if (scale % denominator !== 0n) throw new Error('Objective scale cannot represent F2 exactly');
  return numerator * (scale / denominator);
}

interface State {
  candidate: Candidate; interval: ThresholdInterval; metrics: Metrics;
  f2Units: bigint; abstentions: number; contextChars: number; misses: number;
}
interface Best { state: State; intervals: ThresholdInterval[] }
interface CachedScore { score: QueryScore; f2Units: bigint }

function mergeIntervals(intervals: ThresholdInterval[]): ThresholdInterval[] {
  const merged: ThresholdInterval[] = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (previous && previous.upper === interval.lower) previous.upper = interval.upper;
    else merged.push({ ...interval });
  }
  return merged;
}

function nextUpNonnegative(value: number): number {
  const bits = new DataView(new ArrayBuffer(8));
  bits.setFloat64(0, value);
  bits.setBigUint64(0, bits.getBigUint64(0) + 1n);
  return bits.getFloat64(0);
}

export async function proveRetrieval(): Promise<void> {
  const began = performance.now();
  const files = ['rag-retrieval-queries.json', 'rag-retrieval-confirmation-queries.json', 'rag-retrieval-robust-queries.json'];
  const datasetTexts = files.map(file => readFileSync(resolve(ROOT, 'evals', file), 'utf8'));
  const datasets = datasetTexts.map(text => JSON.parse(text) as { queries: EvalQuery[] });
  if (datasets.some((d, i) => d.queries.length !== [72, 30, 20][i])) throw new Error('Frozen benchmark size changed');
  // Preserve historical files. Validate round-three isolation, then explicitly pool all seen data.
  const queries = datasets.flatMap((d, i) => d.queries.map(q => ({ ...q, split: i < 2 ? 'dev' as const : 'heldout' as const })));
  const corpora = KNOWLEDGE_CHUNKING_CANDIDATES.map(p => ({ ...p, corpus: readCorpus(p.policy) }));
  validateQueries(queries, corpora[0].corpus);
  const cache = JSON.parse(readFileSync(resolve(ROOT, '.tmp/rag-eval/embeddings.json'), 'utf8')) as {
    model: string; dimensions: number; vectors: Record<string, number[]>;
  };
  if (cache.model !== 'text-embedding-3-small' || cache.dimensions !== 1536) throw new Error('Incompatible cache');
  const inputs = new Set([...corpora.flatMap(c => c.corpus.map(p => p.embeddingText)), ...queries.map(q => q.query.trim().slice(0, 8000))]);
  const embeddingDigest = createHash('sha256');
  for (const key of [...inputs].map(hash).sort()) {
    const vector = cache.vectors[key];
    if (!Array.isArray(vector) || vector.length !== 1536 || !vector.every(Number.isFinite) || !vector.some(x => x !== 0)) {
      throw new Error('Missing or invalid cached vector; this command never calls a provider');
    }
    embeddingDigest.update(key).update(JSON.stringify(vector));
  }
  const maxK = 12, positives = queries.filter(q => q.answerable).length, negatives = queries.length - positives;
  const scale = objectiveScale(maxK, Math.max(...queries.map(q => q.evidence.length)));
  const weights = [0, 5, 7, 9, 10]; // tenths assigned to positive macro F2; the rest to negative abstention.
  const objective = (state: State, weight = 7) => BigInt(weight * negatives) * state.f2Units
    + BigInt((10 - weight) * positives * state.abstentions) * scale;
  const denominator = BigInt(10 * positives * negatives) * scale;
  const stateScores = (q: EvalQuery, ranked: RankedChunk[], candidate: Candidate) => scoreQuery(q, selectChunks(q, ranked, candidate));
  const tieCompare = (a: State, b: State) => a.contextChars - b.contextChars || a.candidate.matchCount - b.candidate.matchCount
    || a.candidate.chunking.localeCompare(b.candidate.chunking) || a.candidate.minSimilarity - b.candidate.minSimilarity;
  const better = (a: State, b: State | undefined, weight = 7) => !b || objective(a, weight) > objective(b, weight)
    || (objective(a, weight) === objective(b, weight) && tieCompare(a, b) < 0);
  const serialize = (s: State, intervals = [s.interval]) => ({
    candidate: s.candidate, representativeStateInterval: s.interval,
    primaryObjectiveTieIntervals: mergeIntervals(intervals), metrics: s.metrics, missedPositiveQueries: s.misses,
    objectiveExact: { numerator: objective(s).toString(), denominator: denominator.toString() },
  });
  let best: State | undefined, unconstrained: State | undefined;
  let baseline: { candidate: Candidate; metrics: Metrics; scores: QueryScore[] } | undefined;
  const sensitivity = new Map<number, State>();
  const certificateHash = createHash('sha256');
  const profiles: unknown[] = [];
  const bestPerK: Best[] = [];
  const allRankings = new Map<string, RankedChunk[][]>();
  let totalStates = 0, feasibleStates = 0, parityChecks = 0;
  for (const profile of corpora) {
    if (new Set(profile.corpus.map(c => c.id)).size !== profile.corpus.length) throw new Error(`Duplicate corpus chunk ID: ${profile.name}`);
    const fullRankings = queries.map(q => {
      const filters = normalizeKnowledgeFilters(q), vector = cache.vectors[hash(q.query.trim().slice(0, 8000))];
      return profile.corpus.filter(c => (!filters.country || c.country === filters.country) && (!filters.visaType || c.visaType === filters.visaType))
        .map(chunk => ({ chunk, similarity: cosine(vector, cache.vectors[hash(chunk.embeddingText)]) }))
        .sort((a, b) => b.similarity - a.similarity || a.chunk.id.localeCompare(b.chunk.id));
    });
    const rankings = queries.map((q, i) => compressRanking(q, fullRankings[i], maxK));
    allRankings.set(profile.name, rankings);
    const intervals = thresholdIntervals(rankings);
    // Independent direct parity on every query's own complete score breakpoints, all k.
    for (let qi = 0; qi < queries.length; qi++) {
      for (const interval of thresholdIntervals([fullRankings[qi]])) for (let k = 1; k <= maxK; k++) {
        const candidate = { chunking: profile.name, matchCount: k, minSimilarity: interval.upper };
        const full = selectChunks(queries[qi], fullRankings[qi], candidate).map(r => r.chunk.id);
        const compressed = selectChunks(queries[qi], rankings[qi], candidate).map(r => r.chunk.id);
        if (JSON.stringify(full) !== JSON.stringify(compressed)) throw new Error(`Compression mismatch: ${profile.name}/${queries[qi].id}`);
        parityChecks++;
      }
    }
    if (profile.name === 'seed-semantic') {
      const candidate = { chunking: profile.name, matchCount: 5, minSimilarity: 0.03 };
      const scores = queries.map((q, i) => stateScores(q, fullRankings[i], candidate));
      baseline = { candidate, metrics: aggregate(scores), scores };
    }
    const scoreCaches = queries.map(() => new Map<string, CachedScore>());
    const perK: unknown[] = [];
    let profileFeasible = 0;
    for (let k = 1; k <= maxK; k++) {
      let kBest: Best | undefined;
      let kFeasible = 0;
      for (const interval of intervals) {
        const candidate = { chunking: profile.name, matchCount: k, minSimilarity: interval.upper };
        let f2Units = 0n, abstentions = 0, contextChars = 0, misses = 0;
        const scores = queries.map((q, qi) => {
          const selected = selectChunks(q, rankings[qi], candidate);
          const key = JSON.stringify(selected.map(r => r.chunk.id));
          let cached = scoreCaches[qi].get(key);
          if (!cached) {
            const score = scoreQuery(q, selected);
            cached = { score, f2Units: scaledF2(q, score, scale) };
            scoreCaches[qi].set(key, cached);
          }
          f2Units += cached.f2Units;
          abstentions += Number(!q.answerable && cached.score.abstained);
          contextChars += cached.score.contextChars;
          misses += Number(q.answerable && cached.score.recall !== 1);
          return cached.score;
        });
        const state: State = { candidate, interval, metrics: aggregate(scores), f2Units, abstentions, contextChars, misses };
        totalStates++;
        certificateHash.update(JSON.stringify([profile.name, k, interval, f2Units.toString(), abstentions, contextChars, misses]));
        if (better(state, unconstrained)) unconstrained = state;
        if (misses) continue;
        feasibleStates++; kFeasible++; profileFeasible++;
        if (better(state, best)) best = state;
        for (const weight of weights) if (better(state, sensitivity.get(weight), weight)) sensitivity.set(weight, state);
        if (!kBest || objective(state) > objective(kBest.state)) kBest = { state, intervals: [interval] };
        else if (objective(state) === objective(kBest.state)) {
          kBest.intervals.push(interval);
          if (tieCompare(state, kBest.state) < 0) kBest.state = state;
        }
      }
      if (kBest) bestPerK.push(kBest);
      perK.push({ k, feasibleStates: kFeasible, optimum: kBest ? serialize(kBest.state, kBest.intervals) : null });
    }
    profiles.push({ chunking: profile.name, chunks: profile.corpus.length, thresholdStates: intervals.length,
      evaluatedStates: intervals.length * maxK, feasibleStates: profileFeasible, perK });
    console.log(JSON.stringify({ chunking: profile.name, thresholdStates: intervals.length, feasibleStates: profileFeasible, parityChecks }));
  }
  if (!best || !baseline || !unconstrained) throw new Error('No feasible optimum or baseline');
  const selectedBest = best;
  const scoresFor = (candidate: Candidate) => queries.map((q, qi) => stateScores(q, allRankings.get(candidate.chunking)![qi], candidate));
  const ties = bestPerK.filter(row => objective(row.state) === objective(selectedBest)).map(row => serialize(row.state, row.intervals));
  const winningIntervals = ties.find(row => row.candidate.chunking === selectedBest.candidate.chunking
    && row.candidate.matchCount === selectedBest.candidate.matchCount)!.primaryObjectiveTieIntervals;
  const checks = winningIntervals.flatMap((interval, index) => [
    { reason: `primary tie interval ${index + 1}: lower endpoint`, candidate: { ...selectedBest.candidate, minSimilarity: interval.lower } },
    { reason: `primary tie interval ${index + 1}: just above upper endpoint`, candidate: { ...selectedBest.candidate, minSimilarity: nextUpNonnegative(interval.upper) } },
  ]).filter(check => check.candidate.minSimilarity <= 1);
  checks.push({ reason: 'same threshold with k reduced by one', candidate: { ...selectedBest.candidate, matchCount: selectedBest.candidate.matchCount - 1 } },
    { reason: 'threshold rounded to two decimal places', candidate: { ...selectedBest.candidate, minSimilarity: Number(selectedBest.candidate.minSimilarity.toFixed(2)) } });
  const boundaryChecks = checks.map(check => {
    const scores = scoresFor(check.candidate);
    return { ...check, metrics: aggregate(scores), missedPositiveQueryIds: scores.filter(s => s.answerable && s.recall < 1).map(s => s.id) };
  });
  const result = {
    version: 1, createdAt: new Date().toISOString(),
    claim: 'Exhaustive constrained empirical optimum for this frozen benchmark, seven chunkings, integer k=1..12, all threshold states in [0,1], and the stated metric. NOT unseen-data or production optimality.',
    selectionData: 'All 122 previously seen synthetic questions pooled for descriptive optimization; no new heldout data and no promotion gate.',
    assumptions: ['Every answerable query must cover every annotated evidence span.',
      'Maximize 0.7 * positive macro F2 + 0.3 * negative abstention; exact rational comparisons.',
      'Primary objective ties: minimize total context characters, then k, then chunking name, then representative threshold.',
      'Each metrics object describes its candidate representative only; primaryObjectiveTieIntervals assert equal objective and feasibility, not equal context or retrieval IDs.',
      'Cosine uses local JavaScript float64 arithmetic and exact sorting, then chunk ID localeCompare ties; not PostgreSQL/ANN parity.',
      'Gold relevance is non-exhaustive, synthetic, source-based; measures evidence retrieval, not generated answer quality.'],
    counts: { queries: queries.length, positives, negatives, evidenceSpans: queries.reduce((sum, q) => sum + q.evidence.length, 0),
      policies: corpora.length, kValues: maxK, totalStates, feasibleStates, parityChecks },
    fingerprints: {
      datasets: files.map((file, i) => ({ file, sha256: hash(datasetTexts[i]) })),
      corpora: corpora.map(p => ({ chunking: p.name, sha256: hash(JSON.stringify(p.corpus)) })),
      embeddings: embeddingDigest.digest('hex'), enumeration: certificateHash.digest('hex'),
      code: ['scripts/prove-rag-retrieval.ts', 'scripts/evaluate-rag-retrieval.ts', 'src/services/visa-knowledge-query.ts', 'src/services/visa-knowledge-chunking.ts']
        .map(file => ({ file, sha256: hash(readFileSync(resolve(ROOT, file), 'utf8')) })),
    },
    baseline, winner: { ...serialize(best), scores: scoresFor(best.candidate) }, primaryObjectiveTies: ties,
    unconstrainedWinner: { ...serialize(unconstrained), scores: scoresFor(unconstrained.candidate) },
    weightSensitivity: weights.map(weight => ({ f2Weight: weight / 10, negativeAbstentionWeight: 1 - weight / 10,
      optimum: serialize(sensitivity.get(weight)!), objectiveAtWeight: Number(objective(sensitivity.get(weight)!, weight)) / Number(denominator),
      objectiveExactAtWeight: { numerator: objective(sensitivity.get(weight)!, weight).toString(), denominator: denominator.toString() } })),
    profiles, boundaryChecks,
    arithmeticEnvironment: { node: process.versions.node, v8: process.versions.v8, icu: process.versions.icu },
    runtimeDecision: 'Retain baseline; pooling seen evaluation cases does not supply independent validation for deployment.',
    providerCalls: 0, databaseCalls: 0, elapsedMs: performance.now() - began,
  };
  writeFileSync(resolve(ROOT, 'evals/rag-retrieval-optimality-certificate.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ counts: result.counts, winner: best.candidate, metrics: best.metrics, elapsedMs: result.elapsedMs }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  proveRetrieval().catch(error => { console.error(error instanceof Error ? error.message : 'Certificate failed'); process.exitCode = 1; });
}

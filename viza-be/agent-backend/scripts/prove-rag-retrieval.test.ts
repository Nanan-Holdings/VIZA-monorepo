import { describe, expect, it } from 'vitest';
import {
  compressRanking,
  objectiveScale,
  scaledF2,
  thresholdIntervals,
  type RankedChunk,
} from './prove-rag-retrieval.js';
import {
  scoreQuery,
  selectChunks,
  type CorpusChunk,
  type EvalQuery,
} from './evaluate-rag-retrieval.js';

const makeChunk = (
  id: string,
  overrides: Partial<CorpusChunk> = {}
): CorpusChunk => {
  const content = overrides.content ?? id;
  const parentContent = overrides.parentContent ?? content;
  const sourceStart = overrides.sourceStart ?? 0;
  const sourceEnd = overrides.sourceEnd ?? sourceStart + content.length;
  const base: CorpusChunk = {
    id,
    parentId: id,
    country: 'japan',
    visaType: 'tourist',
    documentType: 'requirements',
    content,
    embeddingText: content,
    parentContent,
    sourceStart,
    sourceEnd,
  };
  return {
    ...base,
    ...overrides,
    id: overrides.id ?? id,
    content,
    parentContent,
    sourceStart,
    sourceEnd,
  };
};

const rank = (chunk: CorpusChunk, similarity: number): RankedChunk => ({
  chunk,
  similarity,
});

const makeQuery = (overrides: Partial<EvalQuery> = {}): EvalQuery => ({
  id: 'adversarial-query',
  split: 'dev',
  query: 'What does the local visa guidance say?',
  country: 'japan',
  visaType: 'tourist',
  relevantChunkIds: ['target'],
  answerable: true,
  rationale: 'Synthetic unit-test query.',
  evidence: [{ chunkId: 'target', text: 'target evidence' }],
  ...overrides,
});

const candidate = (matchCount: number, minSimilarity: number) => ({
  chunking: 'test',
  matchCount,
  minSimilarity,
});

const ids = (ranking: RankedChunk[]): string[] =>
  ranking.map(({ chunk }) => chunk.id);

const nextDouble = (value: number): number => {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value);
  const bits = view.getBigUint64(0);
  view.setBigUint64(0, value >= 0 ? bits + 1n : bits - 1n);
  return view.getFloat64(0);
};

describe('RAG retrieval proof helpers', () => {
  it('keeps full and compressed selections identical for every k and threshold state', () => {
    const query = makeQuery({
      documentTypes: ['requirements'],
    });
    const ranked = [
      rank(makeChunk('outside-country', { country: 'us' }), 1.0001),
      rank(makeChunk('requirements-1'), 1),
      rank(makeChunk('process-1', { documentType: 'process' }), 0.9),
      rank(makeChunk('requirements-2'), 0.8),
      rank(makeChunk('process-2', { documentType: 'process' }), 0.7),
      rank(makeChunk('requirements-3'), 0.6),
      rank(makeChunk('process-3', { documentType: 'process' }), 0.5),
      rank(makeChunk('requirements-4'), 0.4),
      rank(makeChunk('process-4', { documentType: 'process' }), 0.3),
      rank(makeChunk('requirements-5'), 0.2),
      rank(makeChunk('process-5', { documentType: 'process' }), 0.1),
      rank(makeChunk('requirements-6'), 0),
      rank(makeChunk('process-6', { documentType: 'process' }), -0.1),
      rank(makeChunk('requirements-7'), -0.2),
    ];
    const compressed = compressRanking(query, ranked, 12);
    const intervals = thresholdIntervals([ranked]);
    const thresholds = new Set<number>([0, 1]);

    for (const interval of intervals) {
      thresholds.add(interval.upper);
      if (interval.upper > interval.lower) {
        thresholds.add((interval.lower + interval.upper) / 2);
      }
    }

    for (const minSimilarity of thresholds) {
      for (let matchCount = 1; matchCount <= 12; matchCount++) {
        const full = selectChunks(
          query,
          ranked,
          candidate(matchCount, minSimilarity)
        );
        const compact = selectChunks(
          query,
          compressed,
          candidate(matchCount, minSimilarity)
        );
        expect(
          ids(compact),
          String(matchCount) + '@' + String(minSimilarity)
        ).toEqual(ids(full));
      }
    }
  });

  it('retains a relevant typed chunk hidden after the broad top twelve', () => {
    const query = makeQuery({
      id: 'hidden-typed-query',
      intent: 'eligibility',
      documentTypes: undefined,
      relevantChunkIds: ['hidden-requirement'],
      evidence: [{ chunkId: 'hidden-requirement', text: 'target evidence' }],
    });
    const ranked = Array.from({ length: 13 }, (_, index) =>
      rank(
        makeChunk(
          index === 12 ? 'hidden-requirement' : 'broad-' + String(index),
          {
            documentType: index === 12 ? 'requirements' : 'process',
            content: index === 12 ? 'target evidence' : 'broad ' + String(index),
          }
        ),
        1 - index * 0.05
      )
    );
    const compressed = compressRanking(query, ranked, 12);

    expect(ids(compressed)).toContain('hidden-requirement');
    for (let matchCount = 1; matchCount <= 12; matchCount++) {
      expect(
        ids(selectChunks(query, compressed, candidate(matchCount, 0)))
      ).toEqual(ids(selectChunks(query, ranked, candidate(matchCount, 0))));
    }
    expect(ids(selectChunks(query, compressed, candidate(12, 0)))).toEqual([
      'hidden-requirement',
    ]);
  });

  it('never broadens an explicit document-type filter', () => {
    const ranked = [
      rank(
        makeChunk('process-answer', {
          documentType: 'process',
          content: 'target evidence',
        }),
        0.9
      ),
      rank(makeChunk('requirements-distractor'), 0.7),
    ];
    const explicit = makeQuery({
      id: 'explicit-filter',
      documentTypes: ['requirements'],
      relevantChunkIds: ['process-answer'],
      evidence: [{ chunkId: 'process-answer', text: 'target evidence' }],
    });
    const implicit = makeQuery({
      id: 'implicit-eligibility',
      intent: 'eligibility',
      documentTypes: undefined,
      relevantChunkIds: ['process-answer'],
      evidence: [{ chunkId: 'process-answer', text: 'target evidence' }],
    });

    expect(selectChunks(explicit, ranked, candidate(12, 0.8))).toEqual([]);
    expect(ids(selectChunks(explicit, ranked, candidate(12, 0.6)))).toEqual([
      'requirements-distractor',
    ]);

    const broadFallback = selectChunks(
      implicit,
      ranked,
      candidate(12, 0.8)
    );
    const typedResults = selectChunks(
      implicit,
      ranked,
      candidate(12, 0.6)
    );
    const fallbackScore = scoreQuery(implicit, broadFallback);
    const typedScore = scoreQuery(implicit, typedResults);

    expect(ids(broadFallback)).toEqual(['process-answer']);
    expect(ids(typedResults)).toEqual(['requirements-distractor']);
    expect(fallbackScore.recall).toBe(1);
    expect(typedScore.recall).toBe(0);
    expect(typedScore.recall).toBeLessThan(fallbackScore.recall);
  });

  it('treats threshold endpoints and invalid similarity boundaries consistently', () => {
    const query = makeQuery({
      id: 'threshold-boundaries',
      documentTypes: undefined,
      intent: undefined,
    });
    const slightlyAboveOne = 1.000001;
    const ranked = [
      rank(makeChunk('slightly-above-one'), slightlyAboveOne),
      rank(makeChunk('one'), 1),
      rank(makeChunk('zero'), 0),
      rank(makeChunk('negative'), -0.000001),
    ];

    expect(thresholdIntervals([ranked])).toEqual([
      { lower: 0, lowerInclusive: true, upper: 0, upperInclusive: true },
      { lower: 0, lowerInclusive: false, upper: 1, upperInclusive: true },
    ]);
    expect(ids(selectChunks(query, ranked, candidate(12, -1)))).toEqual([
      'slightly-above-one',
      'one',
      'zero',
      'negative',
    ]);
    expect(ids(selectChunks(query, ranked, candidate(12, 0)))).toEqual([
      'slightly-above-one',
      'one',
      'zero',
    ]);
    expect(ids(selectChunks(query, ranked, candidate(12, 1)))).toEqual([
      'slightly-above-one',
      'one',
    ]);
    expect(
      ids(selectChunks(query, ranked, candidate(12, slightlyAboveOne)))
    ).toEqual(['slightly-above-one']);
    expect(
      ids(
        selectChunks(
          query,
          ranked,
          candidate(12, slightlyAboveOne + 0.000001)
        )
      )
    ).toEqual([]);

    const score = 0.3;
    const nextScore = nextDouble(score);
    const roundedScore = Math.fround(score);
    const floatingPointRanked = [
      rank(makeChunk('fround-score'), roundedScore),
      rank(makeChunk('next-double'), nextScore),
      rank(makeChunk('exact-score'), score),
    ];
    expect(
      ids(selectChunks(query, floatingPointRanked, candidate(12, score)))
    ).toEqual(['fround-score', 'next-double', 'exact-score']);
    expect(
      ids(selectChunks(query, floatingPointRanked, candidate(12, nextScore)))
    ).toEqual(['fround-score', 'next-double']);
    expect(
      ids(
        selectChunks(
          query,
          floatingPointRanked,
          candidate(12, roundedScore)
        )
      )
    ).toEqual(['fround-score']);
    expect(
      ids(
        selectChunks(
          query,
          floatingPointRanked,
          candidate(12, nextDouble(roundedScore))
        )
      )
    ).toEqual([]);
  });

  it('preserves deterministic input order for equal scores and deduplicates endpoints', () => {
    const query = makeQuery({
      id: 'equal-score-query',
      documentTypes: ['requirements'],
    });
    const ranked = [
      rank(makeChunk('first'), 0.5),
      rank(makeChunk('second'), 0.5),
      rank(makeChunk('third'), 0.5),
    ];
    const compressed = compressRanking(query, ranked, 12);
    const firstSelection = selectChunks(query, compressed, candidate(2, 0.5));

    expect(thresholdIntervals([ranked])).toEqual([
      { lower: 0, lowerInclusive: true, upper: 0, upperInclusive: true },
      { lower: 0, lowerInclusive: false, upper: 0.5, upperInclusive: true },
      { lower: 0.5, lowerInclusive: false, upper: 1, upperInclusive: true },
    ]);
    expect(ids(compressed)).toEqual(['first', 'second', 'third']);
    expect(ids(firstSelection)).toEqual(['first', 'second']);
    expect(
      ids(
        selectChunks(
          query,
          compressRanking(query, ranked, 12),
          candidate(2, 0.5)
        )
      )
    ).toEqual(ids(firstSelection));
  });

  it('covers complete, partial, and contiguous cross-piece evidence before scaling F2', () => {
    const query = makeQuery({
      id: 'piece-coverage',
      relevantChunkIds: ['shared-parent'],
      evidence: [{ chunkId: 'shared-parent', text: 'alpha beta gamma' }],
    });
    const parentContent = 'alpha beta gamma';
    const partial = rank(
      makeChunk('japan/shared-parent/partial', {
        parentId: 'shared-parent',
        parentContent,
        content: 'alpha beta',
        sourceStart: 0,
        sourceEnd: 'alpha beta'.length,
      }),
      0.9
    );
    const firstPiece = rank(
      makeChunk('japan/shared-parent/part-1', {
        parentId: 'shared-parent',
        parentContent,
        content: 'alpha ',
        sourceStart: 0,
        sourceEnd: 'alpha '.length,
      }),
      0.9
    );
    const secondPiece = rank(
      makeChunk('japan/shared-parent/part-2', {
        parentId: 'shared-parent',
        parentContent,
        content: 'beta gamma',
        sourceStart: 'alpha '.length,
        sourceEnd: parentContent.length,
      }),
      0.8
    );
    const gapPiece = rank(
      makeChunk('japan/shared-parent/gap', {
        parentId: 'shared-parent',
        parentContent,
        content: 'beta gamma',
        sourceStart: 'alpha '.length + 1,
        sourceEnd: parentContent.length + 1,
      }),
      0.8
    );

    expect(scoreQuery(query, [partial]).recall).toBe(0);
    const completeScore = scoreQuery(query, [firstPiece, secondPiece]);
    expect(completeScore.recall).toBe(1);
    expect(completeScore.precision).toBe(1);
    expect(scoreQuery(query, [firstPiece, gapPiece]).recall).toBe(0);

    const scale = objectiveScale(12, query.evidence.length);
    expect(scaledF2(query, completeScore, scale)).toBe(scale);

    const partialEvidenceQuery = makeQuery({
      id: 'partial-evidence-three-spans',
      relevantChunkIds: ['shared-parent'],
      evidence: [
        { chunkId: 'shared-parent', text: 'alpha' },
        { chunkId: 'shared-parent', text: 'beta' },
        { chunkId: 'shared-parent', text: 'gamma' },
      ],
    });
    const partialEvidenceScore = scoreQuery(partialEvidenceQuery, [firstPiece]);
    const partialEvidenceScale = objectiveScale(
      12,
      partialEvidenceQuery.evidence.length
    );
    expect(partialEvidenceScore.recall).toBe(1 / 3);
    expect(scaledF2(
      partialEvidenceQuery,
      partialEvidenceScore,
      partialEvidenceScale
    )).toBe(5n * (partialEvidenceScale / 13n));

    const multiEvidenceQuery = makeQuery({
      id: 'multi-evidence-overlap',
      relevantChunkIds: ['shared-parent'],
      evidence: [
        { chunkId: 'shared-parent', text: 'alpha beta' },
        { chunkId: 'shared-parent', text: 'beta gamma' },
      ],
    });
    const overlapPiece = rank(
      makeChunk('japan/shared-parent/overlap', {
        parentId: 'shared-parent',
        parentContent,
        content: 'beta gamma',
        sourceStart: 'alpha '.length,
        sourceEnd: parentContent.length,
      }),
      0.75
    );
    const noise = rank(
      makeChunk('france/noise', {
        country: 'france',
        parentId: 'noise',
        content: 'unrelated',
      }),
      0.7
    );
    const multiEvidenceScore = scoreQuery(multiEvidenceQuery, [
      firstPiece,
      secondPiece,
      overlapPiece,
      noise,
    ]);
    const multiEvidenceScale = objectiveScale(
      12,
      multiEvidenceQuery.evidence.length
    );
    expect(multiEvidenceScore.recall).toBe(1);
    expect(multiEvidenceScore.precision).toBe(0.5);
    expect(scaledF2(multiEvidenceQuery, multiEvidenceScore, multiEvidenceScale)).toBe(
      5n * (multiEvidenceScale / 6n)
    );
  });

  it('uses country plus parent as the source key and compares F2 with exact integers', () => {
    const query = makeQuery({
      id: 'repeated-parent-different-country',
      country: undefined,
      relevantChunkIds: ['shared'],
      evidence: [
        { chunkId: 'shared', text: 'Japan evidence' },
        { chunkId: 'shared', text: 'US evidence' },
      ],
    });
    const selected = [
      rank(
        makeChunk('japan/shared/complete', {
          country: 'japan',
          parentId: 'shared',
          content: 'Japan evidence',
          parentContent: 'Japan evidence',
        }),
        0.95
      ),
      rank(
        makeChunk('japan/shared/overlap', {
          country: 'japan',
          parentId: 'shared',
          content: 'Japan',
          parentContent: 'Japan evidence',
          sourceStart: 0,
          sourceEnd: 'Japan'.length,
        }),
        0.9
      ),
      rank(
        makeChunk('us/shared/complete', {
          country: 'us',
          parentId: 'shared',
          content: 'US evidence',
          parentContent: 'US evidence',
        }),
        0.85
      ),
      rank(
        makeChunk('france/noise', {
          country: 'france',
          parentId: 'noise',
          content: 'unrelated',
        }),
        0.8
      ),
    ];
    const score = scoreQuery(query, selected);
    const scale = objectiveScale(12, query.evidence.length);
    const exactF2 = scaledF2(query, score, scale);

    expect(score.recall).toBe(1);
    expect(score.precision).toBeCloseTo(2 / 3);
    expect(score.f2).toBeCloseTo(10 / 11);
    expect(score.retrieved).toHaveLength(4);
    expect(exactF2).toBe(10n * (scale / 11n));
    expect(exactF2 * 11n).toBe(10n * scale);
    expect(exactF2 < scale).toBe(true);
    expect(
      scaledF2(
        { ...query, answerable: false, evidence: [] },
        score,
        1n
      )
    ).toBe(0n);
    expect(() => scaledF2(query, score, 1n)).toThrow(
      'Objective scale cannot represent F2 exactly'
    );
  });

  it('builds a scale divisible by every possible F2 denominator', () => {
    const scale = objectiveScale(12, 4);

    for (let denominator = 1; denominator <= 240; denominator++) {
      expect(scale % BigInt(denominator)).toBe(0n);
    }
    expect(objectiveScale(1, 1)).toBe(60n);
    expect(objectiveScale(2, 2)).toBe(232792560n);
  });
});

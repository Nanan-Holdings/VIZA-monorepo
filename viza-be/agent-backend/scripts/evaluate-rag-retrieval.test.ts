import { describe, expect, it } from 'vitest';
import { aggregate, cosine, scoreQuery, selectChunks, validateQueries, type CorpusChunk, type EvalQuery } from './evaluate-rag-retrieval.js';

const chunk = (id: string, content: string, documentType = 'requirements'): CorpusChunk => ({
  id, parentId: id, country: 'japan', visaType: 'tourist', documentType, content, embeddingText: content,
  parentContent: content, sourceStart: 0, sourceEnd: content.length,
});
const query: EvalQuery = {
  id: 'q1', split: 'dev', query: 'How do I show my visa?', country: 'japan',
  relevantChunkIds: ['notice'], answerable: true, rationale: 'The seed describes online display.',
  evidence: [{ chunkId: 'notice', text: 'Display the notice online.' }],
};

describe('RAG experiment validity', () => {
  it('uses cosine similarity, independent of vector magnitude', () => {
    expect(cosine([1, 0], [20, 0])).toBe(1);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([1, 0], [-2, 0])).toBe(-1);
    expect(() => cosine([0, 0], [1, 0])).toThrow();
    expect(() => cosine([1], [1, 2])).toThrow();
  });
  it('counts complete evidence, not a matching parent ID or overlap duplicates', () => {
    const original = chunk('notice', 'Display the notice online. Prints are not accepted.');
    const partial = { ...original, id: 'notice__part_1', content: 'Display the', sourceEnd: 11 };
    expect(scoreQuery(query, [{ chunk: partial, similarity: 0.9 }]).recall).toBe(0);
    const complete = { ...original, id: 'notice__part_2' };
    const score = scoreQuery(query, [{ chunk: complete, similarity: 0.8 }, { chunk: complete, similarity: 0.7 }]);
    expect(score.recall).toBe(1);
    expect(score.f2).toBe(1);
    const rest = { ...original, id: 'notice__part_3', content: original.content.slice(11), sourceStart: 11 };
    expect(scoreQuery(query, [{ chunk: partial, similarity: 0.9 }, { chunk: rest, similarity: 0.8 }]).recall).toBe(1);
    expect(scoreQuery(query, [{ chunk: partial, similarity: 0.9 }, { chunk: { ...rest, sourceStart: 12 }, similarity: 0.8 }]).recall).toBe(0);
  });
  it('keeps explicit metadata constraints when there is no match and broadens only implicit intent', () => {
    const ranked = [{ chunk: chunk('notice', 'Display the notice online.', 'process'), similarity: 0.7 }];
    const candidate = { chunking: 'seed-semantic', matchCount: 5, minSimilarity: 0.5 };
    expect(selectChunks({ ...query, documentTypes: ['requirements'] }, ranked, candidate)).toEqual([]);
    expect(selectChunks({ ...query, intent: 'eligibility' }, ranked, candidate)).toEqual(ranked);
    expect(selectChunks(query, ranked, { ...candidate, minSimilarity: 0.8 })).toEqual([]);
    expect(selectChunks({ ...query, country: 'us' }, ranked, candidate)).toEqual([]);
  });
  it('reports unanswerable retrieval as a false positive and does not add negatives to positive recall', () => {
    const negative = { ...query, id: 'negative', answerable: false, relevantChunkIds: [], evidence: [] };
    const match = { chunk: chunk('notice', 'Display the notice online.'), similarity: 0.9 };
    const bad = aggregate([scoreQuery(query, [match]), scoreQuery(negative, [match])]);
    const good = aggregate([scoreQuery(query, [match]), scoreQuery(negative, [])]);
    expect(bad.recall).toBe(1);
    expect(bad.negativeFalsePositiveRate).toBe(1);
    expect(good.negativeFalsePositiveRate).toBe(0);
    expect(good.objective).toBeGreaterThan(bad.objective);
  });
  it('refuses mismatched evidence, impossible metadata, and parent leakage across splits', () => {
    const corpus = [chunk('notice', 'Display the notice online.')];
    expect(() => validateQueries([{ ...query, country: 'us' }], corpus)).toThrow('Gold excluded');
    expect(() => validateQueries([{ ...query, evidence: [{ chunkId: 'notice', text: 'Invented claim' }] }], corpus)).toThrow('Evidence not in seed');
    expect(() => validateQueries([query, { ...query, id: 'translated', split: 'heldout' }], corpus)).toThrow('leaks across splits');
  });
  it('resolves duplicate seed IDs by metadata instead of overwriting a different country', () => {
    const sources = [chunk('notice', 'Display the notice online.'), { ...chunk('notice', 'Unrelated country facts.'), country: 'us' }];
    // Both positive and negative splits are required, so reaching that check proves the Japanese evidence resolved.
    expect(() => validateQueries([query], sources)).toThrow('Missing dev false cases');
    expect(() => validateQueries([{ ...query, country: undefined }], sources)).toThrow('ambiguous after metadata');
  });
});

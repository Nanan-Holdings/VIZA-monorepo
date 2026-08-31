import { describe, expect, it, vi } from 'vitest';
import {
  createVisaEntryRuleCacheKey,
  VisaEntryRuleCache,
  type VisaEntryRuleCacheKeyInput,
} from './visa-entry-rule-cache.js';

const baseKey: VisaEntryRuleCacheKeyInput = {
  releaseId: 'release-id-1',
  releaseKey: 'release-2026-08-30',
  destinationCountry: 'singapore',
  passportCountryIso3: 'CHN',
  passportType: 'ordinary',
  tripPurpose: 'tourism',
};

describe('visa entry-rule cache', () => {
  it('coalesces and retains a 100-request null-result burst', async () => {
    let release: ((value: null) => void) | undefined;
    const loadRule = vi.fn(
      () =>
        new Promise<null>((resolve) => {
          release = resolve;
        })
    );
    const cache = new VisaEntryRuleCache<null>(8, 60_000);
    const key = createVisaEntryRuleCacheKey(baseKey);

    const requests = Array.from({ length: 100 }, () =>
      cache.getOrCreate(key, loadRule)
    );
    release?.(null);

    const results = await Promise.all(requests);
    expect(
      results.filter((result) => result.source === 'created')
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.source === 'shared')
    ).toHaveLength(99);
    const nextLoad = vi.fn(async () => null);
    await expect(
      cache.getOrCreate(key, nextLoad)
    ).resolves.toEqual({ source: 'cache', value: null });
    expect(loadRule).toHaveBeenCalledTimes(1);
    expect(nextLoad).not.toHaveBeenCalled();
  });

  it('invalidates naturally when the active knowledge release changes', async () => {
    const loadRule = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('release one')
      .mockResolvedValueOnce('release two');
    const cache = new VisaEntryRuleCache<string>(8, 60_000);

    await cache.getOrCreate(createVisaEntryRuleCacheKey(baseKey), loadRule);
    await cache.getOrCreate(
      createVisaEntryRuleCacheKey({
        ...baseKey,
        releaseId: 'release-id-2',
        releaseKey: 'release-2026-08-31',
      }),
      loadRule
    );

    expect(loadRule).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed database lookup', async () => {
    const loadRule = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('temporary database failure'))
      .mockResolvedValueOnce('recovered');
    const cache = new VisaEntryRuleCache<string>(8, 60_000);
    const key = createVisaEntryRuleCacheKey(baseKey);

    await expect(cache.getOrCreate(key, loadRule)).rejects.toThrow(
      'temporary database failure'
    );
    await expect(cache.getOrCreate(key, loadRule)).resolves.toEqual({
      source: 'created',
      value: 'recovered',
    });
    expect(loadRule).toHaveBeenCalledTimes(2);
  });

  it('keys every database lookup dimension but ignores unexpected applicant data', () => {
    const first = createVisaEntryRuleCacheKey(baseKey);
    const differentPurpose = createVisaEntryRuleCacheKey({
      ...baseKey,
      tripPurpose: 'business',
    });
    const withUnexpectedPrivateData = createVisaEntryRuleCacheKey({
      ...baseKey,
      stayLengthDays: 90,
      applicantId: 'must-not-enter-cache-key',
      chatText: 'must-not-enter-cache-key',
    } as VisaEntryRuleCacheKeyInput);

    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(differentPurpose).not.toBe(first);
    expect(withUnexpectedPrivateData).toBe(first);
  });

  it('bounds distinct in-flight keys and bypasses completed caching above the cap', async () => {
    const releases: Array<(value: string) => void> = [];
    const loadRule = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          releases.push(resolve);
        })
    );
    const cache = new VisaEntryRuleCache<string>(8, 60_000, Date.now, 4);

    const requests = Array.from({ length: 10 }, (_, index) =>
      cache.getOrCreate(`key-${index}`, loadRule)
    );
    expect(loadRule).toHaveBeenCalledTimes(10);
    for (const [index, release] of releases.entries()) release(`rule-${index}`);

    const results = await Promise.all(requests);
    expect(results.filter((result) => result.source === 'created')).toHaveLength(4);
    expect(results.filter((result) => result.source === 'bypass')).toHaveLength(6);
  });

  it('expires completed entries and evicts the least recently used key', async () => {
    let now = 0;
    const cache = new VisaEntryRuleCache<string>(2, 100, () => now, 2);

    await cache.getOrCreate('a', async () => 'a1');
    await cache.getOrCreate('b', async () => 'b1');
    await cache.getOrCreate('a', async () => 'unused');
    await cache.getOrCreate('c', async () => 'c1');

    await expect(cache.getOrCreate('b', async () => 'b2')).resolves.toEqual({
      source: 'created',
      value: 'b2',
    });

    now = 101;
    await expect(cache.getOrCreate('c', async () => 'c2')).resolves.toEqual({
      source: 'created',
      value: 'c2',
    });
  });
});

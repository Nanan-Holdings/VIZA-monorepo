import { describe, expect, it, vi } from 'vitest';
import {
  resolveVisaEntryRuleWithDependencies,
  type VisaEntryRule,
  type VisaEntryRuleQuery,
  type VisaEntryRuleResolverDependencies,
} from './visa-entry-rule.service.js';
import { VisaEntryRuleCache } from './visa-entry-rule-cache.js';

const query: VisaEntryRuleQuery = {
  destinationCountry: 'singapore',
  passportCountryIso3: 'CHN',
  passportType: 'ordinary',
  tripPurpose: 'tourism',
  stayLengthDays: 10,
};

const databaseRule: VisaEntryRule = {
  ruleKey: 'singapore:CHN:ordinary:tourism:test',
  destinationCountry: 'singapore',
  passportCountryIso3: 'CHN',
  passportType: 'ordinary',
  tripPurpose: 'tourism',
  maxStayDays: 30,
  outcome: 'visa_exempt',
  visaType: null,
  arrivalCardTypes: ['SG_ARRIVAL_CARD'],
  requiredInputs: [],
  productRecommendations: [],
  conditions: { source: 'database' },
  sourceUrl: 'https://www.ica.gov.sg/',
  effectiveFrom: '2024-02-09',
  effectiveTo: null,
  verifiedAt: '2026-08-30T00:00:00.000Z',
  reviewDueAt: null,
  reviewStatus: 'reviewed',
};

function activeRelease(releaseId = 'release-id-1', releaseKey = 'release-key-1') {
  return {
    success: true,
    message: 'ok',
    latencyMs: 1,
    releaseId,
    releaseKey,
  };
}

function dependencies(
  loadActiveRule: VisaEntryRuleResolverDependencies['loadActiveRule'],
  getActiveRelease: VisaEntryRuleResolverDependencies['getActiveRelease'] =
    async () => activeRelease()
): VisaEntryRuleResolverDependencies {
  return {
    getActiveRelease,
    loadActiveRule,
    cache: new VisaEntryRuleCache<VisaEntryRule | null>(16, 60_000),
  };
}

describe('resolveVisaEntryRuleWithDependencies', () => {
  it('coalesces 100 simultaneous rule reads into one database lookup', async () => {
    let release: ((value: VisaEntryRule) => void) | undefined;
    const loadActiveRule = vi.fn(
      () =>
        new Promise<VisaEntryRule>((resolve) => {
          release = resolve;
        })
    );
    const resolverDependencies = dependencies(loadActiveRule);

    const requests = Array.from({ length: 100 }, () =>
      resolveVisaEntryRuleWithDependencies(query, resolverDependencies)
    );
    await vi.waitFor(() => expect(loadActiveRule).toHaveBeenCalledTimes(1));
    release?.(databaseRule);

    const results = await Promise.all(requests);
    expect(results).toHaveLength(100);
    expect(results.every((rule) => rule?.ruleKey === databaseRule.ruleKey)).toBe(
      true
    );
    expect(loadActiveRule).toHaveBeenCalledTimes(1);
    expect(loadActiveRule).toHaveBeenCalledWith(query, 'release-id-1');
  });

  it('evaluates stay length per request without poisoning the shared base rule', async () => {
    const loadActiveRule = vi.fn(async () => databaseRule);
    const resolverDependencies = dependencies(loadActiveRule);

    const shortStay = await resolveVisaEntryRuleWithDependencies(
      query,
      resolverDependencies
    );
    const longStay = await resolveVisaEntryRuleWithDependencies(
      { ...query, stayLengthDays: 90 },
      resolverDependencies
    );
    if (shortStay) shortStay.conditions.mutatedByCaller = true;
    const shortStayAgain = await resolveVisaEntryRuleWithDependencies(
      query,
      resolverDependencies
    );

    expect(shortStay?.outcome).toBe('visa_exempt');
    expect(longStay).toMatchObject({
      outcome: 'conditional',
      arrivalCardTypes: [],
      requiredInputs: ['stayLengthDays'],
    });
    expect(shortStayAgain?.conditions).toEqual({ source: 'database' });
    expect(loadActiveRule).toHaveBeenCalledTimes(1);
  });

  it('uses a new cache entry when the active release changes', async () => {
    const loadActiveRule = vi.fn(async () => databaseRule);
    const getActiveRelease = vi
      .fn<VisaEntryRuleResolverDependencies['getActiveRelease']>()
      .mockResolvedValueOnce(activeRelease('release-id-1', 'release-key-1'))
      .mockResolvedValueOnce(activeRelease('release-id-2', 'release-key-2'));
    const resolverDependencies = dependencies(loadActiveRule, getActiveRelease);

    await resolveVisaEntryRuleWithDependencies(query, resolverDependencies);
    await resolveVisaEntryRuleWithDependencies(query, resolverDependencies);

    expect(loadActiveRule).toHaveBeenCalledTimes(2);
  });

  it('bypasses shared caching when the active release cannot be identified', async () => {
    const loadActiveRule = vi.fn(async () => databaseRule);
    const getActiveRelease = vi.fn(async () => ({
      success: false,
      message: 'unavailable',
      latencyMs: 1,
      releaseId: null,
      releaseKey: null,
      error: 'unavailable',
    }));
    const resolverDependencies = dependencies(loadActiveRule, getActiveRelease);

    await resolveVisaEntryRuleWithDependencies(query, resolverDependencies);
    await resolveVisaEntryRuleWithDependencies(query, resolverDependencies);

    expect(loadActiveRule).toHaveBeenCalledTimes(2);
  });

  it('does not cache database failures and retries on the next request', async () => {
    const loadActiveRule = vi
      .fn<VisaEntryRuleResolverDependencies['loadActiveRule']>()
      .mockRejectedValueOnce(new Error('temporary database failure'))
      .mockResolvedValueOnce(databaseRule);
    const resolverDependencies = dependencies(loadActiveRule);

    const fallback = await resolveVisaEntryRuleWithDependencies(
      query,
      resolverDependencies
    );
    const recovered = await resolveVisaEntryRuleWithDependencies(
      query,
      resolverDependencies
    );

    expect(fallback?.reviewStatus).toBe('reviewed');
    expect(recovered?.ruleKey).toBe(databaseRule.ruleKey);
    expect(loadActiveRule).toHaveBeenCalledTimes(2);
  });

  it('does not retain missing rows or collapse explicit-purpose fallback semantics', async () => {
    const loadActiveRule = vi.fn(async () => null);
    const resolverDependencies = dependencies(loadActiveRule);

    const missingPurpose = await resolveVisaEntryRuleWithDependencies(
      { ...query, tripPurpose: null },
      resolverDependencies
    );
    const explicitTourism = await resolveVisaEntryRuleWithDependencies(
      query,
      resolverDependencies
    );

    expect(missingPurpose).toMatchObject({
      outcome: 'conditional',
      requiredInputs: ['tripPurpose'],
    });
    expect(explicitTourism?.outcome).toBe('visa_exempt');
    expect(loadActiveRule).toHaveBeenCalledTimes(2);
  });
});

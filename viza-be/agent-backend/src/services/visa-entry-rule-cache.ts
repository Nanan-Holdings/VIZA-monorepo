import { createHash } from 'node:crypto';

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export interface VisaEntryRuleCacheKeyInput {
  releaseId: string;
  releaseKey: string;
  destinationCountry: string;
  passportCountryIso3: string;
  passportType: string;
  tripPurpose: string;
}

export type VisaEntryRuleCacheSource =
  | 'created'
  | 'shared'
  | 'cache'
  | 'bypass';

export interface VisaEntryRuleCacheResult<T> {
  source: VisaEntryRuleCacheSource;
  value: T;
}

/**
 * Fingerprint only public route dimensions and the active knowledge release.
 * Stay length, applicant identity, chat text, and application answers must not
 * enter this shared cache. Stay length is evaluated after the base rule lookup.
 */
export function createVisaEntryRuleCacheKey({
  releaseId,
  releaseKey,
  destinationCountry,
  passportCountryIso3,
  passportType,
  tripPurpose,
}: VisaEntryRuleCacheKeyInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: 1,
        releaseId,
        releaseKey,
        destinationCountry,
        passportCountryIso3,
        passportType,
        tripPurpose,
      })
    )
    .digest('hex');
}

/**
 * Process-local, bounded LRU cache with per-key singleflight. The caller may
 * decline to retain a successful result (for example a missing rule), while a
 * rejected factory is never written and retries normally on the next request.
 */
export class VisaEntryRuleCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxInFlight: number = Math.min(maxEntries, 64)
  ) {
    if (
      !Number.isInteger(maxEntries) ||
      maxEntries < 1 ||
      ttlMs < 1 ||
      !Number.isInteger(maxInFlight) ||
      maxInFlight < 1
    ) {
      throw new Error('Invalid visa entry-rule cache limits');
    }
  }

  async getOrCreate(
    key: string,
    factory: () => Promise<T>,
    shouldCache: (value: T) => boolean = () => true
  ): Promise<VisaEntryRuleCacheResult<T>> {
    const cached = this.read(key);
    if (cached) return { source: 'cache', value: cached.value };

    const shared = this.inFlight.get(key);
    if (shared) return { source: 'shared', value: await shared };

    // Keep untrusted route diversity from growing the in-flight map without
    // bound. The lookup still runs with the original uncached semantics.
    if (this.inFlight.size >= this.maxInFlight) {
      return { source: 'bypass', value: await factory() };
    }

    const pending = factory()
      .then((value) => {
        if (shouldCache(value)) this.write(key, value);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, pending);
    return { source: 'created', value: await pending };
  }

  private read(key: string): CacheEntry<T> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  private write(key: string, value: T): void {
    this.entries.delete(key);
    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }
}

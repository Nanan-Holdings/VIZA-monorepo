const DEFAULT_MAX_ENTRIES = 128;
const DEFAULT_TTL_MS = 5 * 60 * 1_000;
export const PUBLIC_VISA_FORM_SCHEMA_CACHE_TTL_MS = 60_000;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export type StaticMetadataCacheSource = "cache" | "created" | "shared";

export type StaticMetadataCacheResult<T> = {
  source: StaticMetadataCacheSource;
  value: T;
};

export type StaticMetadataCacheOptions<T> = {
  shouldCache?: (value: T) => boolean;
  ttlMs?: number;
};

/**
 * Small process-local cache for non-sensitive, shared visa metadata only.
 *
 * The in-flight map coalesces a cold burst into one Supabase request. Rejected
 * work is never cached, and the bounded LRU prevents a warm Vercel instance
 * from accumulating unbounded keys.
 */
export class BoundedSingleFlightCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(
    private readonly maxEntries = DEFAULT_MAX_ENTRIES,
    private readonly ttlMs = DEFAULT_TTL_MS,
    private readonly now = () => Date.now(),
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error("maxEntries must be a positive integer");
    }
    if (!Number.isFinite(ttlMs) || ttlMs < 1) {
      throw new Error("ttlMs must be positive");
    }
  }

  async getOrCreate(
    key: string,
    factory: () => Promise<T>,
    options: StaticMetadataCacheOptions<T> = {},
  ): Promise<StaticMetadataCacheResult<T>> {
    const ttlMs = options.ttlMs ?? this.ttlMs;
    if (!Number.isFinite(ttlMs) || ttlMs < 1) {
      throw new Error("ttlMs must be positive");
    }
    const cached = this.read(key, this.now());
    if (cached !== undefined) {
      return { source: "cache", value: cached };
    }

    const shared = this.inFlight.get(key);
    if (shared) {
      return { source: "shared", value: await shared };
    }

    const pending = factory()
      .then((value) => {
        if (options.shouldCache?.(value) !== false) {
          this.write(key, value, this.now(), ttlMs);
        }
        return value;
      })
      .finally(() => {
        if (this.inFlight.get(key) === pending) {
          this.inFlight.delete(key);
        }
      });
    this.inFlight.set(key, pending);

    return { source: "created", value: await pending };
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
  }

  private read(key: string, now: number): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  private write(key: string, value: T, now: number, ttlMs: number): void {
    this.entries.delete(key);
    this.entries.set(key, { expiresAt: now + ttlMs, value });

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (typeof oldestKey !== "string") break;
      this.entries.delete(oldestKey);
    }
  }
}

const staticVisaMetadataCache = new BoundedSingleFlightCache<unknown>();

export async function getCachedStaticVisaMetadata<T>(
  key: string,
  factory: () => Promise<T>,
  options: StaticMetadataCacheOptions<T> = {},
): Promise<T> {
  const result = await staticVisaMetadataCache.getOrCreate(
    key,
    factory as () => Promise<unknown>,
    options as StaticMetadataCacheOptions<unknown>,
  );
  return result.value as T;
}

export function clearStaticVisaMetadataCache(): void {
  staticVisaMetadataCache.clear();
}

import { createHash } from "node:crypto";

interface FieldGuidanceCacheField {
  fieldName: string;
  label: string;
  fieldType: string;
  required: boolean;
  stepName?: string | null;
  placeholder?: string | null;
  options?: unknown;
  validationRules?: Record<string, unknown> | null;
  conditionalLogic?: Record<string, unknown> | null;
}

interface FieldGuidanceCacheKeyInput {
  country?: string | null;
  visaType?: string | null;
  locale?: string | null;
  field: FieldGuidanceCacheField;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((record, key) => {
      record[key] = canonicalize((value as Record<string, unknown>)[key]);
      return record;
    }, {});
}

function normalizeLocale(locale?: string | null): "zh" | "en" {
  return locale?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

/**
 * Fingerprints static field metadata only. Applicant answers, questions, and
 * chat history must never enter a shared guidance cache key or value.
 */
export function createFieldGuidanceCacheKey({
  country,
  visaType,
  locale,
  field,
}: FieldGuidanceCacheKeyInput): string {
  const payload = canonicalize({
    country: country?.trim().toLowerCase() || "unknown",
    visaType: visaType?.trim().toUpperCase() || "unknown",
    locale: normalizeLocale(locale),
    field: {
      fieldName: field.fieldName,
      label: field.label,
      fieldType: field.fieldType,
      required: field.required,
      stepName: field.stepName ?? null,
      placeholder: field.placeholder ?? null,
      options: field.options ?? null,
      validationRules: field.validationRules ?? null,
      conditionalLogic: field.conditionalLogic ?? null,
    },
  });

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export type SingleFlightSource = "created" | "shared" | "cache";

export interface SingleFlightResult<T> {
  source: SingleFlightSource;
  value: T;
}

export class BoundedSingleFlightCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1 || ttlMs < 1) {
      throw new Error("Invalid single-flight cache limits");
    }
  }

  async getOrCreate(
    key: string,
    factory: () => Promise<T>,
  ): Promise<SingleFlightResult<T>> {
    const cached = this.read(key);
    if (cached !== undefined) return { source: "cache", value: cached };

    const shared = this.inFlight.get(key);
    if (shared) return { source: "shared", value: await shared };

    const pending = factory()
      .then((value) => {
        this.write(key, value);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, pending);
    return { source: "created", value: await pending };
  }

  private read(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    // Refresh insertion order so eviction behaves as a bounded LRU.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  private write(key: string, value: T): void {
    this.entries.delete(key);
    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

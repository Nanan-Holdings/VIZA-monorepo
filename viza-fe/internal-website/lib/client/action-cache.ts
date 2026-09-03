"use client";

/**
 * A tiny stale-while-revalidate cache for server-action reads in the portal.
 *
 * The portal's tabs read the same few things over and over — the applicant's
 * application list, their package, a visa form schema — and every tab switch
 * used to pay the full remote round trip again, which is most of what an
 * applicant experiences as "the page is loading". Here a navigation renders the
 * value already in memory and refreshes it in the background, so the second
 * visit to a tab is immediate and still ends up current.
 *
 * Scope is one browser tab: the cache lives in module memory, is dropped on a
 * full reload, and is never persisted. In-flight requests for the same key are
 * shared, so two components mounting at once make one request.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type Entry<T> = {
  value: T;
  fetchedAt: number;
  inflight: Promise<T> | null;
};

/** Values older than this are refreshed in the background on next read. */
const DEFAULT_STALE_MS = 10_000;
/** Values older than this are not shown at all; the read waits for fresh data. */
const DEFAULT_MAX_AGE_MS = 5 * 60_000;

const store = new Map<string, Entry<unknown>>();
const subscribers = new Map<string, Set<() => void>>();

function notify(key: string) {
  subscribers.get(key)?.forEach((listener) => listener());
}

function entryFor<T>(key: string): Entry<T> | undefined {
  return store.get(key) as Entry<T> | undefined;
}

/** Reads the cached value without triggering a fetch. */
export function peekCached<T>(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): T | undefined {
  const entry = entryFor<T>(key);
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt > maxAgeMs) return undefined;
  return entry.value;
}

/** Fetches through the cache, sharing any request already in flight. */
export function fetchCached<T>(
  key: string,
  loader: () => Promise<T>,
  { staleMs = DEFAULT_STALE_MS }: { staleMs?: number } = {},
): Promise<T> {
  const entry = entryFor<T>(key);

  if (entry?.inflight) return entry.inflight;
  if (entry && Date.now() - entry.fetchedAt <= staleMs) {
    return Promise.resolve(entry.value);
  }

  const inflight = loader()
    .then((value) => {
      store.set(key, { value, fetchedAt: Date.now(), inflight: null });
      notify(key);
      return value;
    })
    .catch((error: unknown) => {
      // Keep the previous value usable; a failed refresh must not blank a tab.
      if (entry) {
        store.set(key, { ...entry, inflight: null });
      } else {
        store.delete(key);
      }
      throw error;
    });

  store.set(key, {
    value: entry?.value as T,
    fetchedAt: entry?.fetchedAt ?? 0,
    inflight,
  });
  return inflight;
}

/** Drops cached values. Pass a prefix to clear one family of keys. */
export function invalidateCached(prefix?: string) {
  if (!prefix) {
    const keys = [...store.keys()];
    store.clear();
    keys.forEach(notify);
    return;
  }
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      notify(key);
    }
  }
}

/** Writes a value into the cache, e.g. after a mutation returns fresh data. */
export function primeCached<T>(key: string, value: T) {
  store.set(key, { value, fetchedAt: Date.now(), inflight: null });
  notify(key);
}

export type CachedActionState<T> = {
  data: T | undefined;
  /** True only when there is nothing to show yet. */
  isLoading: boolean;
  /** True while a background refresh is running over existing data. */
  isRevalidating: boolean;
  error: unknown;
  refresh: () => Promise<T | undefined>;
};

/**
 * Subscribes a component to a cached read.
 *
 * On mount it renders whatever is already cached (no spinner on a return
 * visit) and revalidates when that value is older than `staleMs`.
 * Pass `enabled: false` to hold off until the key is known.
 */
export function useCachedAction<T>(
  key: string | null,
  loader: () => Promise<T>,
  {
    staleMs = DEFAULT_STALE_MS,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
    enabled = true,
  }: { staleMs?: number; maxAgeMs?: number; enabled?: boolean } = {},
): CachedActionState<T> {
  const [, forceRender] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (!key) return;
    const listener = () => forceRender((tick) => tick + 1);
    const listeners = subscribers.get(key) ?? new Set<() => void>();
    listeners.add(listener);
    subscribers.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) subscribers.delete(key);
    };
  }, [key]);

  const run = useCallback(async () => {
    if (!key) return undefined;
    setIsRevalidating(true);
    try {
      const value = await fetchCached<T>(key, () => loaderRef.current(), { staleMs });
      setError(null);
      return value;
    } catch (caught) {
      setError(caught);
      return undefined;
    } finally {
      setIsRevalidating(false);
    }
  }, [key, staleMs]);

  useEffect(() => {
    if (!key || !enabled) return;
    void run();
  }, [key, enabled, run]);

  const data = key ? peekCached<T>(key, maxAgeMs) : undefined;

  return {
    data,
    isLoading: enabled && data === undefined && error === null,
    isRevalidating,
    error,
    refresh: useCallback(async () => {
      if (key) invalidateCached(key);
      return run();
    }, [key, run]),
  };
}

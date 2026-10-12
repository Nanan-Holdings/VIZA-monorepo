/**
 * A tab-local safety net for dynamic application edits that have not reached
 * the server yet. The long form still owns the real save queue; this cache is
 * only used to survive a page refresh while that queue is waiting.
 *
 * Keep this in sessionStorage rather than a process-wide cache. Applicant
 * answers are user-scoped data and must never be shared between applications,
 * profiles, or server requests.
 */

const STORAGE_PREFIX = "viza:application-draft-cache:v1:";
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

export interface ApplicationDraftCacheScope {
  applicationId: string;
  profileId?: string | null;
  country: string;
  visaType: string;
}

export interface ApplicationDraftCacheEntry {
  revision: number;
  updatedAt: number;
  answers: Record<string, string>;
  fieldRevisions: Record<string, number>;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getStorageKey(scope: ApplicationDraftCacheScope): string {
  // The key contains identifiers only; answers are kept in the value and are
  // never interpolated into a key or URL.
  const identity = JSON.stringify([
    scope.applicationId.trim(),
    scope.profileId?.trim() ?? "",
    scope.country.trim().toLowerCase(),
    scope.visaType.trim().toUpperCase(),
  ]);
  return `${STORAGE_PREFIX}${encodeURIComponent(identity)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeEntry(value: unknown): ApplicationDraftCacheEntry | null {
  if (!isRecord(value)) return null;

  const revision = typeof value.revision === "number" && Number.isFinite(value.revision)
    ? Math.max(1, Math.floor(value.revision))
    : 0;
  const updatedAt = typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
    ? value.updatedAt
    : 0;
  if (revision <= 0 || updatedAt <= 0 || Date.now() - updatedAt > MAX_CACHE_AGE_MS) return null;

  const answers: Record<string, string> = {};
  if (isRecord(value.answers)) {
    for (const [fieldName, fieldValue] of Object.entries(value.answers)) {
      if (typeof fieldValue === "string") answers[fieldName] = fieldValue;
    }
  }
  if (Object.keys(answers).length === 0) return null;

  const fieldRevisions: Record<string, number> = {};
  if (isRecord(value.fieldRevisions)) {
    for (const fieldName of Object.keys(answers)) {
      const fieldRevision = value.fieldRevisions[fieldName];
      fieldRevisions[fieldName] = typeof fieldRevision === "number" && Number.isFinite(fieldRevision)
        ? Math.max(1, Math.floor(fieldRevision))
        : revision;
    }
  } else {
    for (const fieldName of Object.keys(answers)) fieldRevisions[fieldName] = revision;
  }

  return { revision, updatedAt, answers, fieldRevisions };
}

function readRawEntry(scope: ApplicationDraftCacheScope): ApplicationDraftCacheEntry | null {
  const storage = getStorage();
  if (!storage) return null;
  const key = getStorageKey(scope);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const entry = normalizeEntry(JSON.parse(raw) as unknown);
    if (!entry) storage.removeItem(key);
    return entry;
  } catch {
    return null;
  }
}

function writeRawEntry(scope: ApplicationDraftCacheScope, entry: ApplicationDraftCacheEntry): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(getStorageKey(scope), JSON.stringify(entry));
  } catch {
    // Private browsing and storage quota policies must never block form input.
  }
}

function removeStoredEntry(scope: ApplicationDraftCacheScope): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(getStorageKey(scope));
  } catch {
    // Storage policy failures must never turn a successful server save into a
    // visible form error.
  }
}

/** Read the pending patch for one exact application/profile scope. */
export function readApplicationDraftCache(
  scope: ApplicationDraftCacheScope,
): ApplicationDraftCacheEntry | null {
  const entry = readRawEntry(scope);
  return entry
    ? {
        revision: entry.revision,
        updatedAt: entry.updatedAt,
        answers: { ...entry.answers },
        fieldRevisions: { ...entry.fieldRevisions },
      }
    : null;
}

/**
 * Merge a pending patch into the tab-local cache. Idempotent patches keep the
 * existing revision, which lets duplicate queue requests share one cleanup
 * record without making a successful save look stale.
 */
export function writeApplicationDraftCache(
  scope: ApplicationDraftCacheScope,
  patch: Readonly<Record<string, string>>,
): ApplicationDraftCacheEntry | null {
  const entries = Object.entries(patch).filter(([, value]) => typeof value === "string");
  if (entries.length === 0) return readApplicationDraftCache(scope);

  const current = readRawEntry(scope);
  const nextAnswers = { ...(current?.answers ?? {}) };
  const changedFields = entries
    .filter(([fieldName, value]) => nextAnswers[fieldName] !== value)
    .map(([fieldName]) => fieldName);
  if (changedFields.length === 0 && current) return readApplicationDraftCache(scope);

  const revision = (current?.revision ?? 0) + 1;
  const fieldRevisions = { ...(current?.fieldRevisions ?? {}) };
  for (const [fieldName, value] of entries) {
    nextAnswers[fieldName] = value;
    if (nextAnswers[fieldName] !== current?.answers[fieldName]) fieldRevisions[fieldName] = revision;
  }

  const next: ApplicationDraftCacheEntry = {
    revision,
    updatedAt: Date.now(),
    answers: nextAnswers,
    fieldRevisions,
  };
  writeRawEntry(scope, next);
  return readApplicationDraftCache(scope) ?? next;
}

/**
 * Reconcile a complete step draft against the last server-backed answer
 * snapshot. DynamicStepForm publishes the whole visible step after a text
 * edit, so caching that object verbatim would incorrectly retain unchanged
 * answers as pending work.
 */
export function syncApplicationDraftCache(
  scope: ApplicationDraftCacheScope,
  stepDraft: Readonly<Record<string, string>>,
  persistedAnswers: Readonly<Record<string, string>>,
): ApplicationDraftCacheEntry | null {
  const current = readRawEntry(scope);
  const nextAnswers = { ...(current?.answers ?? {}) };
  const nextFieldRevisions = { ...(current?.fieldRevisions ?? {}) };
  const changedFields = Object.entries(stepDraft).filter(([, value]) => typeof value === "string");
  const fieldsToWrite = changedFields.filter(
    ([fieldName, value]) => (
      (persistedAnswers[fieldName] ?? "") !== value
      || Object.prototype.hasOwnProperty.call(nextAnswers, fieldName)
    ) && nextAnswers[fieldName] !== value,
  );
  if (fieldsToWrite.length === 0) {
    return current ? readApplicationDraftCache(scope) : null;
  }

  const revision = (current?.revision ?? 0) + 1;
  for (const [fieldName, value] of fieldsToWrite) {
    nextAnswers[fieldName] = value;
    nextFieldRevisions[fieldName] = revision;
  }

  if (Object.keys(nextAnswers).length === 0) {
    removeStoredEntry(scope);
    return null;
  }

  const next: ApplicationDraftCacheEntry = {
    revision,
    updatedAt: Date.now(),
    answers: nextAnswers,
    fieldRevisions: nextFieldRevisions,
  };
  writeRawEntry(scope, next);
  return readApplicationDraftCache(scope) ?? next;
}

/**
 * Remove only values that were part of a successful save and were not edited
 * again after the save was queued. A newer field revision always wins.
 */
export function clearSavedApplicationDraftCache(
  scope: ApplicationDraftCacheScope,
  savedPatch: Readonly<Record<string, string>>,
  queuedRevision?: number,
): void {
  const current = readRawEntry(scope);
  if (!current) return;

  const nextAnswers = { ...current.answers };
  const nextFieldRevisions = { ...current.fieldRevisions };
  let changed = false;
  for (const [fieldName, savedValue] of Object.entries(savedPatch)) {
    const fieldRevision = current.fieldRevisions[fieldName] ?? current.revision;
    if (
      current.answers[fieldName] === savedValue
      && (queuedRevision === undefined || fieldRevision <= queuedRevision)
    ) {
      delete nextAnswers[fieldName];
      delete nextFieldRevisions[fieldName];
      changed = true;
    }
  }

  if (!changed) return;
  if (Object.keys(nextAnswers).length === 0) {
    removeStoredEntry(scope);
    return;
  }

  writeRawEntry(scope, {
    revision: current.revision + 1,
    updatedAt: Date.now(),
    answers: nextAnswers,
    fieldRevisions: nextFieldRevisions,
  });
}

/** Remove a scope explicitly when an application reaches a terminal state. */
export function clearApplicationDraftCache(scope: ApplicationDraftCacheScope): void {
  removeStoredEntry(scope);
}

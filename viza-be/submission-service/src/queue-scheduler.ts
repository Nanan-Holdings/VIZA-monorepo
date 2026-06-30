import type { SubmissionQueueItem } from "./types";

export interface SubmissionConcurrencyKey {
  applicationKey: string;
  accountCountryKey: string;
}

export interface SubmissionQueueBatchOptions {
  concurrency: number;
}

type SubmissionQueueHandler = (item: SubmissionQueueItem) => Promise<void>;

function normalizedProvider(item: SubmissionQueueItem): string {
  if (item.provider?.trim()) return item.provider.trim();
  if (item.status.startsWith("ds160_")) return "ceac_ds160";
  if (item.status.startsWith("fv_") || item.status.startsWith("france_")) return "france_visas";
  if (item.status.startsWith("uk_")) return "ukvi";
  if (item.status.startsWith("vn_")) return "vietnam_evisa";
  if (item.status.startsWith("sgac_")) return "sg_arrival_card";
  if (item.status.startsWith("mdac_")) return "malaysia_mdac";
  if (item.status.startsWith("tdac_")) return "thailand_tdac";
  if (item.status.startsWith("id_c1_")) return "indonesia_c1";
  if (item.status.startsWith("id_b1_evoa_")) return "indonesia_b1_evoa";
  if (item.status.startsWith("phetravel_")) return "philippines_etravel";
  if (item.status.startsWith("au_")) return "australia_visitor";
  return "legacy_submission";
}

export function getSubmissionConcurrencyKey(item: SubmissionQueueItem): SubmissionConcurrencyKey {
  const userScope = item.user_id?.trim() || "unknown-user";
  const providerScope = normalizedProvider(item);

  return {
    applicationKey: `application:${item.application_id}`,
    accountCountryKey: `account-country:${userScope}:${providerScope}`,
  };
}

function hasConflict(keys: SubmissionConcurrencyKey, activeKeys: Set<string>): boolean {
  return activeKeys.has(keys.applicationKey) || activeKeys.has(keys.accountCountryKey);
}

function addKeys(keys: SubmissionConcurrencyKey, activeKeys: Set<string>): void {
  activeKeys.add(keys.applicationKey);
  activeKeys.add(keys.accountCountryKey);
}

function removeKeys(keys: SubmissionConcurrencyKey, activeKeys: Set<string>): void {
  activeKeys.delete(keys.applicationKey);
  activeKeys.delete(keys.accountCountryKey);
}

export async function runSubmissionQueueBatch(
  items: SubmissionQueueItem[],
  handler: SubmissionQueueHandler,
  options: SubmissionQueueBatchOptions,
): Promise<void> {
  const pending = [...items];
  const activeKeys = new Set<string>();
  const maxConcurrency = Math.max(1, Math.floor(options.concurrency));
  let activeCount = 0;
  let firstError: unknown = null;

  await new Promise<void>((resolve, reject) => {
    const maybeStartNext = () => {
      if (firstError) {
        if (activeCount === 0) reject(firstError);
        return;
      }

      while (activeCount < maxConcurrency) {
        const nextIndex = pending.findIndex((item) => {
          const keys = getSubmissionConcurrencyKey(item);
          return !hasConflict(keys, activeKeys);
        });

        if (nextIndex === -1) break;

        const [item] = pending.splice(nextIndex, 1);
        const keys = getSubmissionConcurrencyKey(item);
        addKeys(keys, activeKeys);
        activeCount += 1;

        void Promise.resolve()
          .then(() => handler(item))
          .catch((error) => {
            firstError ??= error;
          })
          .finally(() => {
            activeCount -= 1;
            removeKeys(keys, activeKeys);

            if (firstError && activeCount === 0) {
              reject(firstError);
              return;
            }
            if (pending.length === 0 && activeCount === 0) {
              resolve();
              return;
            }
            maybeStartNext();
          });
      }

      if (pending.length === 0 && activeCount === 0) resolve();
    };

    maybeStartNext();
  });
}

export function readSubmissionQueueConcurrency(env: NodeJS.ProcessEnv): number {
  const raw = env.SUBMISSION_SERVICE_MAX_CONCURRENCY?.trim();
  if (!raw) return 2;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

export type DynamicAnswerPatch = Readonly<Record<string, string>>;

type SaveDynamicAnswers = (
  applicationId: string,
  patch: Record<string, string>,
) => Promise<void>;
type SaveOperation = (patch: Record<string, string>) => Promise<void>;
type SaveTail = { current: Promise<void> };
type QueueEntry = { scope: string; signature: string; promise: Promise<void> };

export interface OrderedDynamicSaveQueue {
  enqueue(
    applicationScope: string,
    patch: DynamicAnswerPatch,
    operation?: SaveOperation,
    options?: { deduplicate?: boolean },
  ): Promise<void>;
  drain(): Promise<void>;
}

/** One page-owned tail; only adjacent identical in-flight writes may join. */
export function createOrderedDynamicSaveQueue(
  defaultSave?: SaveDynamicAnswers,
  tail: SaveTail = { current: Promise.resolve() },
): OrderedDynamicSaveQueue {
  let latest: QueueEntry | null = null;
  return {
    enqueue(applicationScope, patch, operation, options) {
      const snapshot = { ...patch };
      if (Object.keys(snapshot).length === 0) return Promise.resolve();
      const signature = JSON.stringify(
        Object.entries(snapshot).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0),
      );
      if (options?.deduplicate !== false && latest?.scope === applicationScope && latest.signature === signature) {
        return latest.promise;
      }

      // Register before any identity lookup or network await. The submission
      // barrier must include waiting operations, not only writes already sent.
      const run = tail.current.then(async () => {
        if (operation) await operation(snapshot);
        else if (defaultSave) await defaultSave(applicationScope, snapshot);
        else throw new Error("Dynamic answer save operation is unavailable");
      });
      const entry: QueueEntry = { scope: applicationScope, signature, promise: run };
      latest = options?.deduplicate === false ? null : entry;
      tail.current = run.then(() => undefined, () => undefined);
      const clearPending = () => { if (latest === entry) latest = null; };
      void run.then(clearPending, clearPending);
      return run;
    },
    async drain() {
      let pending: Promise<void>;
      do {
        pending = tail.current;
        await pending;
      } while (pending !== tail.current);
    },
  };
}

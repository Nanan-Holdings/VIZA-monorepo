export type StorageExistsResult = {
  data: boolean | null;
  error: unknown;
};

export type StorageExists = (path: string) => Promise<StorageExistsResult>;

const MAX_CONCURRENT_EXISTENCE_CHECKS = 4;

export async function loadExistingDocumentPaths(
  paths: readonly string[],
  exists: StorageExists,
): Promise<Set<string>> {
  const uniquePaths = Array.from(new Set(paths));
  const existingPaths = new Set<string>();
  if (uniquePaths.length === 0) return existingPaths;

  let nextIndex = 0;
  let rejected = false;
  let firstRejection: unknown;

  const worker = async (): Promise<void> => {
    while (!rejected) {
      const path = uniquePaths[nextIndex];
      nextIndex += 1;
      if (path === undefined) return;

      try {
        const result = await exists(path);
        if (!result.error && result.data === true) {
          existingPaths.add(path);
        }
      } catch (error) {
        if (!rejected) {
          rejected = true;
          firstRejection = error;
        }
        return;
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_EXISTENCE_CHECKS, uniquePaths.length) },
      () => worker(),
    ),
  );

  if (rejected) throw firstRejection;
  return existingPaths;
}

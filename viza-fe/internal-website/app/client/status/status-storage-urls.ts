export type StatusStorageTarget = {
  bucket: string;
  path: string;
};

type SignedUrlBatchEntry = {
  path: string | null;
  signedUrl: string | null;
  error: string | null;
};

type SignedUrlBatchResult = {
  data: SignedUrlBatchEntry[] | null;
  error: unknown;
};

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_PATHS_PER_BATCH = 100;
const MAX_IN_FLIGHT_BATCHES = 2;

function addSignedUrl(
  urls: Map<string, Map<string, string>>,
  bucket: string,
  entry: SignedUrlBatchEntry,
  requestedPaths: ReadonlySet<string>,
) {
  if (
    !entry.path ||
    !requestedPaths.has(entry.path) ||
    !entry.signedUrl ||
    entry.error
  ) {
    return;
  }

  const bucketUrls = urls.get(bucket) ?? new Map<string, string>();
  bucketUrls.set(entry.path, entry.signedUrl);
  urls.set(bucket, bucketUrls);
}

/**
 * Resolve private Storage URLs for a single already-authorized request.
 * Targets are deduplicated by bucket/path, signed in batches of at most 100,
 * and processed by no more than two batches at a time. Failed or missing
 * entries are intentionally omitted so callers can preserve their null URL
 * behavior without retrying individual files.
 */
export async function loadStatusStorageUrls(
  targets: readonly StatusStorageTarget[],
  signBatch: (
    bucket: string,
    paths: string[],
    expiresIn: number,
  ) => Promise<SignedUrlBatchResult>,
): Promise<Map<string, Map<string, string>>> {
  const pathsByBucket = new Map<string, string[]>();
  const seenTargets = new Set<string>();

  for (const target of targets) {
    if (!target.bucket || !target.path) continue;
    const dedupeKey = `${target.bucket}\u0000${target.path}`;
    if (seenTargets.has(dedupeKey)) continue;
    seenTargets.add(dedupeKey);
    const paths = pathsByBucket.get(target.bucket) ?? [];
    paths.push(target.path);
    pathsByBucket.set(target.bucket, paths);
  }

  const batches: Array<{ bucket: string; paths: string[] }> = [];
  for (const [bucket, paths] of pathsByBucket) {
    for (let offset = 0; offset < paths.length; offset += MAX_PATHS_PER_BATCH) {
      batches.push({
        bucket,
        paths: paths.slice(offset, offset + MAX_PATHS_PER_BATCH),
      });
    }
  }

  const urls = new Map<string, Map<string, string>>();
  let nextBatchIndex = 0;
  const runWorker = async () => {
    while (true) {
      const batchIndex = nextBatchIndex;
      nextBatchIndex += 1;
      const batch = batches[batchIndex];
      if (!batch) return;

      try {
        const response = await signBatch(
          batch.bucket,
          batch.paths,
          SIGNED_URL_TTL_SECONDS,
        );
        if (response.error || !response.data) continue;
        const requestedPaths = new Set(batch.paths);
        for (const entry of response.data) {
          addSignedUrl(urls, batch.bucket, entry, requestedPaths);
        }
      } catch {
        // A failed batch leaves its entries absent. There is no per-file retry.
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_IN_FLIGHT_BATCHES, batches.length) },
      () => runWorker(),
    ),
  );

  return urls;
}

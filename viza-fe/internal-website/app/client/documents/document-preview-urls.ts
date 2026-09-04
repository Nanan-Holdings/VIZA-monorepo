export interface SignedUrlBatchEntry {
  error: string | null;
  path: string | null;
  signedUrl: string | null;
}

export type CreateSignedUrls = (
  paths: string[],
  expiresIn: number,
) => Promise<
  | { data: SignedUrlBatchEntry[]; error: null }
  | { data: null; error: { message: string } }
>;

export async function loadDocumentPreviewUrls(
  paths: string[],
  createSignedUrls: CreateSignedUrls,
): Promise<Map<string, string>> {
  const uniquePaths = Array.from(
    new Set(paths.map((path) => path.trim()).filter(Boolean)),
  );
  if (uniquePaths.length === 0) return new Map();

  let result: Awaited<ReturnType<CreateSignedUrls>>;
  try {
    result = await createSignedUrls(uniquePaths, 60 * 60);
  } catch {
    return new Map();
  }

  const { data, error } = result;
  if (error || !data) return new Map();

  const urls = new Map<string, string>();
  for (const entry of data) {
    if (!entry.error && entry.path && entry.signedUrl) {
      urls.set(entry.path, entry.signedUrl);
    }
  }
  return urls;
}

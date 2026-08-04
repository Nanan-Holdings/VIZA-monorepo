import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const releaseKey = process.argv[2]?.trim();
if (!releaseKey) {
  throw new Error('Usage: npm run promote:visa-rag -- <release-key>');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase credentials');

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function verifyOfficialSources(): Promise<void> {
  const { data: release, error: releaseError } = await supabase
    .from('visa_knowledge_releases')
    .select('id')
    .eq('release_key', releaseKey)
    .eq('status', 'staged')
    .single();
  if (releaseError || !release) {
    throw new Error(`Staged release not found: ${releaseKey}`);
  }

  const { data: documents, error } = await supabase
    .from('visa_documents')
    .select('source_key, source_url')
    .eq('release_id', (release as { id: string }).id);
  if (error) throw new Error(error.message);

  const uniqueSources = new Map<string, string>();
  for (const document of documents ?? []) {
    const source = document as { source_key: string; source_url: string | null };
    if (!source.source_url) {
      throw new Error(`${source.source_key} has no official source URL`);
    }
    if (!uniqueSources.has(source.source_url)) {
      uniqueSources.set(source.source_url, source.source_key);
    }
  }

  const sources = Array.from(uniqueSources, ([source_url, source_key]) => ({
    source_key,
    source_url,
  }));
  for (let offset = 0; offset < sources.length; offset += 8) {
    await Promise.all(
      sources.slice(offset, offset + 8).map(async (source) => {
        let response = await fetch(source.source_url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: AbortSignal.timeout(15_000),
        }).catch(() => null);
        if (!response || response.status === 405 || response.status >= 500) {
          response = await fetch(source.source_url, {
            method: 'GET',
            headers: { Range: 'bytes=0-1023' },
            redirect: 'follow',
            signal: AbortSignal.timeout(15_000),
          }).catch(() => null);
        }
        if (!response || response.status >= 500) {
          throw new Error(
            `${source.source_key} official source is not reachable (${response?.status ?? 'network error'})`
          );
        }
      })
    );
  }
}

async function main(): Promise<void> {
  await verifyOfficialSources();
  const { data, error } = await supabase.rpc('promote_visa_knowledge_release', {
    target_release_key: releaseKey,
  });
  if (error) throw new Error(error.message);
  console.log(`Activated knowledge release ${releaseKey} (${String(data)})`);
}

await main();

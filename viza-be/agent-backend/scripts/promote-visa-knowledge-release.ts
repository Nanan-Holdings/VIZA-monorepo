import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import {
  getVisaProduct,
  isAllowedOfficialProductUrl,
} from '../src/config/visa-product-registry.js';

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

const REVIEWED_DESTINATIONS = [
  'indonesia',
  'vietnam',
  'singapore',
  'malaysia',
  'thailand',
  'south_korea',
  'us',
  'france',
  'philippines',
  'uk',
  'taiwan',
] as const;
const REVIEWED_PASSPORTS = ['CHN', 'SGP', 'GBR', 'USA', 'CAN', 'AUS', 'NZL'] as const;

interface StoredProductRecommendation {
  productCode?: unknown;
  requirement?: unknown;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function fetchOfficialSource(sourceUrl: string): Promise<Response | null> {
  let lastResponse: Response | null = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      lastResponse = await fetch(sourceUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
      });
      if (
        (lastResponse.status >= 200 && lastResponse.status < 400) ||
        lastResponse.status === 401 ||
        lastResponse.status === 403
      ) {
        return lastResponse;
      }
    } catch {
      lastResponse = null;
    }

    try {
      lastResponse = await fetch(sourceUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-1023' },
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
      });
      if (lastResponse.status < 500) return lastResponse;
    } catch {
      lastResponse = null;
    }

    if (attempt < 4) await sleep(Math.min(1_000 * 2 ** (attempt - 1), 8_000));
  }
  return lastResponse;
}

async function verifyReviewedMatrixAndProducts(releaseId: string): Promise<void> {
  const { data, error } = await supabase
    .from('visa_entry_rules')
    .select(
      'rule_key, destination_country, passport_country_iso3, outcome, review_status, required_inputs, product_recommendations, source_url, verified_at, review_due_at'
    )
    .eq('release_id', releaseId)
    .in('destination_country', [...REVIEWED_DESTINATIONS])
    .in('passport_country_iso3', [...REVIEWED_PASSPORTS])
    .eq('passport_type', 'ordinary')
    .eq('trip_purpose', 'tourism');
  if (error) throw new Error(`Unable to verify reviewed entry rules: ${error.message}`);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length !== REVIEWED_DESTINATIONS.length * REVIEWED_PASSPORTS.length) {
    throw new Error(`Reviewed matrix must contain exactly 77 rows; found ${rows.length}`);
  }

  const seen = new Set<string>();
  const internalProducts = new Set<string>();
  for (const row of rows) {
    const matrixKey = `${String(row.destination_country)}:${String(row.passport_country_iso3)}`;
    if (seen.has(matrixKey)) throw new Error(`Duplicate reviewed matrix row: ${matrixKey}`);
    seen.add(matrixKey);
    if (row.review_status !== 'reviewed') {
      throw new Error(`${String(row.rule_key)} is not marked reviewed`);
    }
    if (row.outcome === 'unknown') {
      throw new Error(`${String(row.rule_key)} still uses the placeholder unknown outcome`);
    }
    if (
      (row.outcome === 'conditional' || row.outcome === 'unknown') &&
      (!Array.isArray(row.required_inputs) || row.required_inputs.length === 0)
    ) {
      throw new Error(`${String(row.rule_key)} must list required inputs`);
    }
    if (
      typeof row.source_url !== 'string' ||
      !row.source_url.startsWith('https://') ||
      !row.verified_at ||
      !row.review_due_at
    ) {
      throw new Error(`${String(row.rule_key)} is missing review or official-source metadata`);
    }

    if (!Array.isArray(row.product_recommendations)) {
      throw new Error(`${String(row.rule_key)} product recommendations are not an array`);
    }
    if (row.outcome === 'unknown' && row.product_recommendations.length > 0) {
      throw new Error(`${String(row.rule_key)} cannot recommend a product while its outcome is unknown`);
    }

    for (const stored of row.product_recommendations as StoredProductRecommendation[]) {
      if (typeof stored.productCode !== 'string') {
        throw new Error(`${String(row.rule_key)} contains a recommendation without a product code`);
      }
      if (row.outcome === 'conditional' && stored.requirement !== 'conditional') {
        throw new Error(
          `${String(row.rule_key)} may only retain conditional product candidates before its inputs are resolved`
        );
      }
      const definition = getVisaProduct(stored.productCode);
      if (!definition) throw new Error(`${String(row.rule_key)} references unknown product ${stored.productCode}`);
      if (definition.country !== row.destination_country) {
        throw new Error(`${stored.productCode} does not belong to ${String(row.destination_country)}`);
      }
      if (definition.provider === 'official') {
        if (!isAllowedOfficialProductUrl(definition.url)) {
          throw new Error(`${stored.productCode} does not use an allowlisted official URL`);
        }
      } else {
        internalProducts.add(definition.productCode);
      }
      if (row.outcome === 'visa_exempt' && definition.kind === 'visa') {
        throw new Error(`${String(row.rule_key)} is visa-exempt but recommends visa ${stored.productCode}`);
      }
    }
  }

  for (const productCode of internalProducts) {
    const product = getVisaProduct(productCode);
    if (!product) continue;
    const packageCountry = product.packageCountry ?? product.country;
    const { data: packages, error: packageError } = await supabase
      .from('visa_packages')
      .select('id')
      .eq('country', packageCountry)
      .eq('visa_type', productCode)
      .eq('is_active', true)
      .limit(1);
    if (packageError || !packages?.length) {
      throw new Error(`${productCode} has no active VIZA package (${packageError?.message ?? 'missing'})`);
    }

    const { count, error: fieldsError } = await supabase
      .from('visa_form_fields')
      .select('id', { count: 'exact', head: true })
      .eq('visa_type', productCode);
    if (fieldsError || !count) {
      throw new Error(`${productCode} has no loadable form fields (${fieldsError?.message ?? 'missing'})`);
    }
  }
}

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

  await verifyReviewedMatrixAndProducts((release as { id: string }).id);

  const sources = Array.from(uniqueSources, ([source_url, source_key]) => ({
    source_key,
    source_url,
  }));
  const sourceFailures: string[] = [];
  for (let offset = 0; offset < sources.length; offset += 8) {
    await Promise.all(
      sources.slice(offset, offset + 8).map(async (source) => {
        const response = await fetchOfficialSource(source.source_url);
        if (!response || response.status >= 500) {
          sourceFailures.push(
            `${source.source_key} official source is not reachable (${response?.status ?? 'network error'})`
          );
          return;
        }
        if (response.status === 404 || response.status === 410) {
          sourceFailures.push(
            `${source.source_key} official source is stale (HTTP ${response.status})`
          );
        }
      })
    );
  }
  if (sourceFailures.length > 0) {
    throw new Error(
      `Official source gate failed for ${sourceFailures.length} source(s):\n${sourceFailures.join('\n')}`
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

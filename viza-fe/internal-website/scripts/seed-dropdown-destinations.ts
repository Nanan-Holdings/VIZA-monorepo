import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildLocalFirstDestinationPayload,
  getDropdownDestinationContracts,
  normalizeDestinationSearchText,
  type LocalFirstDestinationPayload,
  type TravelAttractionContract,
  type TravelDestinationAssetContract,
  type TravelDestinationContract,
} from "../lib/travel/destination-contracts";

type SupabaseClient = ReturnType<typeof createClient>;

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

function createSupabaseAdminClient(): SupabaseClient {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function upsertAsset(
  supabase: SupabaseClient,
  entityId: string,
  asset: TravelDestinationAssetContract
): Promise<string | null> {
  const { data, error } = await supabase
    .from("travel_assets")
    .upsert(
      {
        entity_type: asset.entityType,
        entity_id: entityId,
        asset_type: asset.assetType,
        image_url: asset.imageUrl,
        thumbnail_url: asset.thumbnailUrl ?? asset.imageUrl,
        source: asset.source,
        source_url: asset.sourceUrl,
        attribution: asset.attribution,
        license: asset.license,
        confidence_score: asset.confidenceScore,
        verified: asset.verified,
        is_primary: asset.isPrimary,
      },
      { onConflict: "entity_type,entity_id,asset_type,image_url" }
    )
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return typeof data?.id === "string" ? data.id : null;
}

async function upsertAttraction(
  supabase: SupabaseClient,
  destinationId: string,
  attraction: TravelAttractionContract
): Promise<string | null> {
  const { data, error } = await supabase
    .from("travel_attractions")
    .upsert(
      {
        destination_id: destinationId,
        canonical_name: attraction.canonicalName,
        name_en: attraction.nameEn,
        name_zh: attraction.nameZh,
        description_en: attraction.descriptionEn,
        description_zh: attraction.descriptionZh,
        category: attraction.category,
        latitude: attraction.latitude,
        longitude: attraction.longitude,
        recommended_duration_minutes: attraction.recommendedDurationMinutes,
        popularity_score: attraction.popularityScore,
        data_quality: attraction.dataQuality,
        source: attraction.source,
        source_url: attraction.sourceUrl,
      },
      { onConflict: "destination_id,canonical_name" }
    )
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return typeof data?.id === "string" ? data.id : null;
}

function destinationCardsForPayload(
  payload: LocalFirstDestinationPayload,
  destinationId: string,
  coverAssetId: string | null
) {
  const destination = payload.destination;
  const attractions = payload.attractionCards.slice(0, 8);
  return [
    {
      destination_id: destinationId,
      card_type: "destination_overview",
      title: destination.nameEn,
      title_en: destination.nameEn,
      title_zh: destination.nameZh,
      subtitle: `${destination.countryNameEn} · ${payload.completenessScore}% local coverage`,
      subtitle_en: `${destination.countryNameEn} · ${payload.completenessScore}% local coverage`,
      subtitle_zh: `${destination.countryNameZh} · 本地资料覆盖 ${payload.completenessScore}%`,
      description_en: `${destination.nameEn} is ready from local destination data.`,
      description_zh: `${destination.nameZh}已可从本地资料即时渲染。`,
      image_url: payload.coverImage?.imageUrl ?? null,
      image_asset_id: coverAssetId,
      payload_json: payload,
      source: payload.sourceStatus,
      source_status: payload.sourceStatus,
      is_generated: false,
      confidence_score: payload.completenessScore / 100,
    },
    {
      destination_id: destinationId,
      card_type: "attraction",
      title: `${destination.nameEn} attractions`,
      title_en: `${destination.nameEn} attractions`,
      title_zh: `${destination.nameZh}景点`,
      subtitle: `${attractions.length} local attraction cards`,
      subtitle_en: `${attractions.length} local attraction cards`,
      subtitle_zh: `${attractions.length} 个本地景点卡片`,
      description_en: "Verified local attraction cards for itinerary generation.",
      description_zh: "用于行程生成的本地优先景点卡片。",
      image_url: attractions.find((item) => item.image)?.image?.imageUrl ?? null,
      image_asset_id: null,
      payload_json: { attractions },
      source: payload.sourceStatus,
      source_status: payload.sourceStatus,
      is_generated: false,
      confidence_score: payload.completenessScore / 100,
    },
  ];
}

async function seedDestination(
  supabase: SupabaseClient,
  destination: TravelDestinationContract
): Promise<void> {
  const payload = buildLocalFirstDestinationPayload(destination);
  const { data, error } = await supabase
    .from("travel_destinations")
    .upsert(
      {
        canonical_name: destination.canonicalName,
        display_name: destination.nameEn,
        normalized_name: normalizeDestinationSearchText(destination.canonicalName),
        name_en: destination.nameEn,
        name_zh: destination.nameZh,
        aliases_json: destination.aliases,
        country_code: destination.countryCode,
        country_name: destination.countryNameEn,
        country_name_en: destination.countryNameEn,
        country_name_zh: destination.countryNameZh,
        region: destination.region,
        city: destination.city,
        place_type: "city",
        latitude: destination.latitude,
        longitude: destination.longitude,
        timezone: destination.timezone,
        currency: destination.currency,
        popularity_score: destination.isPopular ? 94 : 72,
        source: "local_curated",
        confidence_score: destination.completenessScore / 100,
        is_verified: destination.dataQuality === "verified",
        is_active: true,
        is_searchable: true,
        show_on_home: destination.isPopular,
        is_featured: destination.isPopular,
        is_dropdown_enabled: true,
        is_popular: destination.isPopular,
        data_quality: destination.dataQuality,
        completeness_score: destination.completenessScore,
        last_enriched_at:
          destination.dataQuality === "verified" ? new Date().toISOString() : null,
      },
      { onConflict: "normalized_name,country_code" }
    )
    .select("id")
    .maybeSingle();

  if (error) throw error;
  const destinationId = typeof data?.id === "string" ? data.id : null;
  if (!destinationId) {
    throw new Error(`Failed to upsert destination ${destination.nameEn}.`);
  }

  await supabase.from("travel_destination_aliases").upsert(
    destination.aliases.map((alias) => ({
      destination_id: destinationId,
      alias,
      normalized_alias: normalizeDestinationSearchText(alias),
      language: /[\u3400-\u9fff]/.test(alias) ? "zh" : "en",
      source: "local_curated",
    })),
    { onConflict: "destination_id,normalized_alias" }
  );

  const coverAssetId = destination.coverImage
    ? await upsertAsset(supabase, destinationId, destination.coverImage)
    : null;

  for (const attraction of destination.attractions) {
    const attractionId = await upsertAttraction(
      supabase,
      destinationId,
      attraction
    );
    if (attractionId && attraction.image) {
      await upsertAsset(supabase, attractionId, attraction.image);
    }
  }

  await supabase.from("travel_destination_cards").upsert(
    destinationCardsForPayload(payload, destinationId, coverAssetId),
    { onConflict: "destination_id,card_type" }
  );

  if (destination.missingFields.length > 0) {
    await supabase.from("travel_enrichment_jobs").insert({
      destination_id: destinationId,
      status: "queued",
      missing_fields_json: destination.missingFields,
      provider: "internal_curated",
    });
  }
}

async function main() {
  const supabase = createSupabaseAdminClient();
  const contracts = getDropdownDestinationContracts();
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "", 10) : null;
  const selected = Number.isInteger(limit) && limit && limit > 0
    ? contracts.slice(0, limit)
    : contracts;

  for (const destination of selected) {
    await seedDestination(supabase, destination);
    console.log(
      `seeded ${destination.nameEn} (${destination.countryCode}) · ${destination.attractions.length} attractions`
    );
  }

  console.log(`Seeded ${selected.length} dropdown destinations.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

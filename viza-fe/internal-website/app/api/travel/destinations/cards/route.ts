import { createAdminClient } from "@/lib/supabase/admin";
import {
  createGeneratedDestinationDraft,
  buildLocalFirstDestinationPayload,
  findDropdownDestinationContract,
  normalizeDestinationSearchText,
  type LocalFirstDestinationPayload,
  type TravelAttractionContract,
  type TravelDestinationAssetContract,
  type TravelDestinationContract,
} from "@/lib/travel/destination-contracts";
import {
  generateLazyDestinationCards,
  resolveLocalDestinationText,
  type LazyDestinationCardType,
  type LazyTravelDestinationCard,
  type TravelDestinationSearchResult,
} from "@/lib/travel/destination-resolver";
import type { Json } from "@/types/database";

type CardsRequestBody = {
  destinationId?: string;
  destinationText?: string;
  destination?: TravelDestinationSearchResult;
};

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

type PersistedDestination = {
  destinationId: string;
  coverAssetId: string | null;
  enrichmentQueued: boolean;
};

const PLACEHOLDER_IMAGE_URL = "/travel/cities/travel-fallback.svg";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseBody(value: unknown): CardsRequestBody {
  if (!isRecord(value)) return {};
  return {
    destinationId:
      typeof value.destinationId === "string" ? value.destinationId : undefined,
    destinationText:
      typeof value.destinationText === "string"
        ? value.destinationText
        : undefined,
    destination: isRecord(value.destination)
      ? (value.destination as TravelDestinationSearchResult)
      : undefined,
  };
}

function destinationLabelFromBody(body: CardsRequestBody): string {
  return (
    body.destination?.nameEn ??
    body.destination?.displayName ??
    body.destination?.canonicalName ??
    body.destinationText ??
    body.destinationId ??
    ""
  ).trim();
}

function isMissingDatabaseShapeError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const message =
    typeof error.message === "string" ? error.message.toLowerCase() : "";
  const code = typeof error.code === "string" ? error.code : "";
  return (
    code === "42P01" ||
    code === "42703" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("column") ||
    message.includes("relationship")
  );
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function payloadToLazyCards(
  payload: LocalFirstDestinationPayload,
  destinationId: string
): LazyTravelDestinationCard[] {
  const destination = payload.destination;
  const coverImage = payload.coverImage?.imageUrl ?? PLACEHOLDER_IMAGE_URL;
  const attractions = payload.attractionCards.slice(0, 8);
  const basePayload = {
    destination_id: destinationId,
    canonical_name: destination.canonicalName,
    name_en: destination.nameEn,
    name_zh: destination.nameZh,
    country_code: destination.countryCode,
    country_name_en: destination.countryNameEn,
    country_name_zh: destination.countryNameZh,
    coordinates:
      destination.latitude !== null && destination.longitude !== null
        ? { lat: destination.latitude, lng: destination.longitude }
        : null,
    data_quality: payload.dataQuality,
    source_status: payload.sourceStatus,
    missing_fields: payload.missingFields,
  };

  const cards: Array<{
    cardType: LazyDestinationCardType;
    title: string;
    subtitle: string;
    imageUrl: string | null;
    payloadJson: Record<string, unknown>;
  }> = [
    {
      cardType: "destination_overview",
      title: destination.nameEn,
      subtitle: `${destination.countryNameEn} · ${payload.completenessScore}% local data coverage`,
      imageUrl: payload.coverImage ? coverImage : null,
      payloadJson: {
        ...basePayload,
        description_en: `${destination.nameEn} has local-first destination data, verified cover media, and map-ready attraction records when available.`,
        description_zh: `${destination.nameZh}已优先使用本地目的地资料；缺失图片或景点会进入补全流程。`,
      },
    },
    {
      cardType: "top_attractions",
      title: `${destination.nameEn} attractions`,
      subtitle:
        attractions.length >= 3
          ? `${attractions.length} local attraction cards available.`
          : "Attraction cards pending enrichment.",
      imageUrl: attractions.find((item) => item.image)?.image?.imageUrl ?? null,
      payloadJson: {
        ...basePayload,
        attractions: attractions.map((item) => ({
          key: item.key,
          name_en: item.nameEn,
          name_zh: item.nameZh,
          description_en: item.descriptionEn,
          description_zh: item.descriptionZh,
          lat: item.latitude,
          lng: item.longitude,
          image_url: item.image?.imageUrl ?? null,
          source_url: item.sourceUrl,
          data_quality: item.dataQuality,
        })),
      },
    },
    {
      cardType: "map_route",
      title: `${destination.nameEn} map markers`,
      subtitle:
        payload.mapMarkers.length > 0
          ? `${payload.mapMarkers.length} stable local markers.`
          : "Map marker pending verified coordinates.",
      imageUrl: payload.coverImage ? coverImage : null,
      payloadJson: {
        ...basePayload,
        markers: payload.mapMarkers,
      },
    },
  ];

  return cards.map((card) => ({
    id: `${destinationId}-${card.cardType}`,
    destinationId,
    cardType: card.cardType,
    title: card.title,
    subtitle: card.subtitle,
    imageUrl: card.imageUrl,
    payloadJson: toJson(card.payloadJson),
    source: payload.sourceStatus,
    isGenerated: payload.sourceStatus === "llm_generated",
    confidenceScore: payload.completenessScore / 100,
  }));
}

async function upsertAsset(
  admin: SupabaseAdminClient,
  entityId: string,
  asset: TravelDestinationAssetContract
): Promise<string | null> {
  const { data, error } = await admin
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
  admin: SupabaseAdminClient,
  destinationId: string,
  attraction: TravelAttractionContract
): Promise<string | null> {
  const { data, error } = await admin
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

async function queueEnrichmentJob(
  admin: SupabaseAdminClient,
  destinationId: string,
  contract: TravelDestinationContract
): Promise<boolean> {
  if (contract.missingFields.length === 0) return false;

  const { error } = await admin.from("travel_enrichment_jobs").insert({
    destination_id: destinationId,
    status: "queued",
    missing_fields_json: contract.missingFields,
    provider:
      process.env.TRAVEL_DESTINATION_ENRICHMENT_PROVIDERS?.split(",")[0]?.trim() ||
      "internal_curated",
  });

  if (error) throw error;
  return true;
}

async function persistLocalContract(
  contract: TravelDestinationContract,
  cards: LazyTravelDestinationCard[]
): Promise<PersistedDestination | null> {
  try {
    const admin = createAdminClient();
    const { data: destinationRow, error: destinationError } = await admin
      .from("travel_destinations")
      .upsert(
        {
          canonical_name: contract.canonicalName,
          display_name: contract.nameEn,
          normalized_name: normalizeDestinationSearchText(contract.canonicalName),
          name_en: contract.nameEn,
          name_zh: contract.nameZh,
          aliases_json: contract.aliases,
          country_code: contract.countryCode,
          country_name: contract.countryNameEn,
          country_name_en: contract.countryNameEn,
          country_name_zh: contract.countryNameZh,
          region: contract.region,
          city: contract.city,
          place_type: "city",
          latitude: contract.latitude,
          longitude: contract.longitude,
          timezone: contract.timezone,
          currency: contract.currency,
          popularity_score: contract.isPopular ? 94 : 72,
          source: "local_curated",
          confidence_score: contract.completenessScore / 100,
          is_verified: contract.dataQuality === "verified",
          is_active: contract.isActive,
          is_searchable: true,
          show_on_home: contract.isPopular,
          is_featured: contract.isPopular,
          is_dropdown_enabled: contract.isDropdownEnabled,
          is_popular: contract.isPopular,
          data_quality: contract.dataQuality,
          completeness_score: contract.completenessScore,
          last_enriched_at:
            contract.dataQuality === "verified" ? new Date().toISOString() : null,
        },
        { onConflict: "normalized_name,country_code" }
      )
      .select("id")
      .maybeSingle();

    if (destinationError) throw destinationError;
    const destinationId =
      typeof destinationRow?.id === "string" ? destinationRow.id : null;
    if (!destinationId) return null;

    await admin.from("travel_destination_aliases").upsert(
      contract.aliases.map((alias) => ({
        destination_id: destinationId,
        alias,
        normalized_alias: normalizeDestinationSearchText(alias),
        language: /[\u3400-\u9fff]/.test(alias) ? "zh" : "en",
        source: "local_curated",
      })),
      { onConflict: "destination_id,normalized_alias" }
    );

    const coverAssetId = contract.coverImage
      ? await upsertAsset(admin, destinationId, contract.coverImage)
      : null;

    for (const attraction of contract.attractions) {
      const attractionId = await upsertAttraction(admin, destinationId, attraction);
      if (attractionId && attraction.image) {
        await upsertAsset(admin, attractionId, attraction.image);
      }
    }

    await admin.from("travel_destination_cards").upsert(
      cards.map((card) => ({
        destination_id: destinationId,
        card_type: card.cardType,
        title: card.title,
        title_en: card.title,
        title_zh:
          card.cardType === "destination_overview"
            ? contract.nameZh
            : `${contract.nameZh}景点`,
        subtitle: card.subtitle,
        subtitle_en: card.subtitle,
        subtitle_zh:
          card.cardType === "destination_overview"
            ? `${contract.countryNameZh} · 本地资料覆盖 ${contract.completenessScore}%`
            : "本地优先景点资料",
        description_en:
          typeof card.payloadJson === "object" &&
          card.payloadJson &&
          "description_en" in card.payloadJson
            ? String(card.payloadJson.description_en)
            : null,
        description_zh:
          typeof card.payloadJson === "object" &&
          card.payloadJson &&
          "description_zh" in card.payloadJson
            ? String(card.payloadJson.description_zh)
            : null,
        image_url: card.imageUrl,
        image_asset_id: card.cardType === "destination_overview" ? coverAssetId : null,
        payload_json: card.payloadJson,
        source: card.source,
        source_status: card.source,
        is_generated: card.isGenerated,
        confidence_score: card.confidenceScore,
      })),
      { onConflict: "destination_id,card_type" }
    );

    const enrichmentQueued = await queueEnrichmentJob(
      admin,
      destinationId,
      contract
    );

    return {
      destinationId,
      coverAssetId,
      enrichmentQueued,
    };
  } catch (error) {
    if (!isMissingDatabaseShapeError(error)) {
      console.warn(
        "Travel local-first contract cache skipped:",
        error instanceof Error ? error.message : "unknown database error"
      );
    }
    return null;
  }
}

function resolveDestinationFromBody(
  body: CardsRequestBody
): TravelDestinationSearchResult | null {
  if (body.destination) return body.destination;
  const destinationText = destinationLabelFromBody(body);
  if (!destinationText) return null;

  const resolution = resolveLocalDestinationText(destinationText);
  if (resolution.status === "resolved") return resolution.destinations[0] ?? null;
  if (resolution.status === "temporary") return resolution.destination;
  return null;
}

async function handleCardsRequest(body: CardsRequestBody) {
  try {
    const destination = resolveDestinationFromBody(body);
    const label = destinationLabelFromBody(body);
    const contract =
      findDropdownDestinationContract(destination?.nameEn ?? null) ??
      findDropdownDestinationContract(destination?.displayName ?? null) ??
      findDropdownDestinationContract(label);

    if (contract) {
      const initialPayload = buildLocalFirstDestinationPayload(contract);
      const initialCards = payloadToLazyCards(initialPayload, contract.key);
      const persisted = await persistLocalContract(contract, initialCards);
      const payload = buildLocalFirstDestinationPayload(contract, {
        enrichmentQueued: persisted?.enrichmentQueued ?? false,
      });
      const destinationId = persisted?.destinationId ?? contract.key;
      const cards = payloadToLazyCards(payload, destinationId);

      return Response.json(
        {
          destination: {
            id: destinationId,
            canonicalName: contract.canonicalName,
            displayName: contract.nameEn,
            nameEn: contract.nameEn,
            nameZh: contract.nameZh,
            countryCode: contract.countryCode,
            countryName: contract.countryNameEn,
            countryNameEn: contract.countryNameEn,
            countryNameZh: contract.countryNameZh,
            city: contract.city,
            latitude: contract.latitude,
            longitude: contract.longitude,
            dataQuality: contract.dataQuality,
            sourceStatus: contract.sourceStatus,
            completenessScore: contract.completenessScore,
            attractionCount: contract.attractions.length,
            missingFields: contract.missingFields,
          },
          cards,
          payload,
          source: persisted ? "database_cache" : "local_verified",
        },
        { status: 200 }
      );
    }

    if (!destination && !label) {
      return Response.json(
        { error: "destinationId or destinationText is required." },
        { status: 400 }
      );
    }

    const draft = createGeneratedDestinationDraft(
      destination?.displayName ?? label
    );
    const payload = buildLocalFirstDestinationPayload(draft, {
      enrichmentQueued: false,
    });
    const cards = generateLazyDestinationCards(
      destination ?? {
        id: draft.key,
        canonicalName: draft.canonicalName,
        displayName: draft.nameEn,
        normalizedName: normalizeDestinationSearchText(draft.nameEn),
        countryCode: null,
        countryName: null,
        region: null,
        city: draft.city,
        placeType: "city",
        latitude: null,
        longitude: null,
        popularityScore: 0,
        source: "llm_text_fallback",
        confidenceScore: 0.45,
        isVerified: false,
        imageKey: null,
        dataQuality: "generated",
        sourceStatus: "llm_generated",
        completenessScore: draft.completenessScore,
        attractionCount: 0,
        missingFields: draft.missingFields,
      },
      { source: "llm_text_fallback", isGenerated: true }
    ).map((card) => ({
      ...card,
      imageUrl: null,
      source: "llm_generated",
      payloadJson: toJson({
        ...((isRecord(card.payloadJson) ? card.payloadJson : {}) as Record<
          string,
          unknown
        >),
        image_status: "placeholder",
        data_quality: "generated",
      }),
    }));

    return Response.json(
      {
        destination: draft,
        cards,
        payload,
        source: "llm_generated_text_only",
        warning: "No verified local destination matched; placeholder imagery only.",
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load travel cards.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destinationId = url.searchParams.get("destinationId") ?? undefined;
  const destinationText = url.searchParams.get("destinationText") ?? undefined;
  return handleCardsRequest({ destinationId, destinationText });
}

export async function POST(request: Request) {
  const body = parseBody(await request.json().catch(() => ({})));
  return handleCardsRequest(body);
}

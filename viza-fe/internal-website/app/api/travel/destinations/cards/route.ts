import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateLazyDestinationCards,
  parseDatabaseDestination,
  resolveLocalDestinationText,
  type LazyDestinationCardType,
  type LazyTravelDestinationCard,
  type TravelDestinationSearchResult,
} from "@/lib/travel/destination-resolver";
import type { Json } from "@/types/database";

type DestinationRow = Parameters<typeof parseDatabaseDestination>[0];

type CardRow = {
  id: string;
  destination_id: string;
  card_type: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  payload_json: Json;
  source: string | null;
  is_generated: boolean | null;
  confidence_score: string | number | null;
};

type CardsRequestBody = {
  destinationId?: string;
  destinationText?: string;
  destination?: TravelDestinationSearchResult;
};

const DESTINATION_SELECT =
  "id, canonical_name, display_name, normalized_name, country_code, country_name, region, city, place_type, latitude, longitude, popularity_score, source, confidence_score, is_verified, is_featured, show_on_home";

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

function toConfidence(value: string | number | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 1;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 1;
  }
  return 1;
}

function parseCardRow(row: CardRow): LazyTravelDestinationCard {
  return {
    id: `${row.destination_id}-${row.card_type}`,
    destinationId: row.destination_id,
    cardType: row.card_type as LazyDestinationCardType,
    title: row.title,
    subtitle: row.subtitle ?? "Generated travel card.",
    imageUrl: row.image_url,
    payloadJson: row.payload_json,
    source: row.source ?? "database",
    isGenerated: row.is_generated ?? false,
    confidenceScore: toConfidence(row.confidence_score),
  };
}

async function loadDatabaseDestination(
  destinationId: string
): Promise<TravelDestinationSearchResult | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("travel_destinations")
    .select(DESTINATION_SELECT)
    .eq("id", destinationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? parseDatabaseDestination(data as DestinationRow) : null;
}

async function loadOrGenerateDatabaseCards(
  destination: TravelDestinationSearchResult
): Promise<LazyTravelDestinationCard[]> {
  const admin = createAdminClient();
  const { data: existingRows, error: existingError } = await admin
    .from("travel_destination_cards")
    .select(
      "id, destination_id, card_type, title, subtitle, image_url, payload_json, source, is_generated, confidence_score"
    )
    .eq("destination_id", destination.id)
    .order("card_type", { ascending: true });

  if (existingError) throw new Error(existingError.message);
  const existingCards = ((existingRows ?? []) as CardRow[]).map(parseCardRow);
  if (existingCards.length > 0) return existingCards;

  const generatedCards = generateLazyDestinationCards(destination, {
    source: destination.isVerified ? "enrichment" : "llm_fallback",
    isGenerated: true,
  });

  const { error: insertError } = await admin
    .from("travel_destination_cards")
    .upsert(
      generatedCards.map((card) => ({
        destination_id: destination.id,
        card_type: card.cardType,
        title: card.title,
        subtitle: card.subtitle,
        image_url: card.imageUrl,
        payload_json: card.payloadJson,
        source: card.source,
        is_generated: true,
        confidence_score: card.confidenceScore,
      })),
      { onConflict: "destination_id,card_type" }
    );

  if (insertError) throw new Error(insertError.message);
  return generatedCards;
}

async function resolveDestinationFromBody(
  body: CardsRequestBody
): Promise<TravelDestinationSearchResult | null> {
  if (body.destination) return body.destination;
  if (body.destinationId && !body.destinationId.startsWith("local-")) {
    return loadDatabaseDestination(body.destinationId);
  }
  if (!body.destinationText) return null;

  const resolution = resolveLocalDestinationText(body.destinationText);
  if (resolution.status === "resolved") return resolution.destinations[0] ?? null;
  if (resolution.status === "temporary") return resolution.destination;
  return null;
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

async function handleCardsRequest(body: CardsRequestBody) {
  try {
    const destination = await resolveDestinationFromBody(body);
    if (!destination) {
      return Response.json(
        { error: "destinationId or destinationText is required." },
        { status: 400 }
      );
    }

    if (destination.id.startsWith("local-") || destination.id.startsWith("temp-")) {
      return Response.json(
        {
          destination,
          cards: generateLazyDestinationCards(destination, {
            source: destination.source,
            isGenerated: true,
          }),
          source: "fallback",
        },
        { status: 200 }
      );
    }

    try {
      const cards = await loadOrGenerateDatabaseCards(destination);
      return Response.json(
        {
          destination,
          cards,
          source: "database",
        },
        { status: 200 }
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Card cache unavailable.";
      console.warn("Travel destination cards using fallback:", message);
      return Response.json(
        {
          destination,
          cards: generateLazyDestinationCards(destination, {
            source: "resolver_fallback",
            isGenerated: true,
          }),
          source: "fallback",
          warning: "Card cache unavailable; generated uncached fallback cards.",
        },
        { status: 200 }
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load travel cards.";
    return Response.json({ error: message }, { status: 500 });
  }
}

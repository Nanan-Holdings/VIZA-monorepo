import { getUserFromSupabaseSession } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type TravelSessionArchive = {
  version: number;
  updatedAt?: string;
  sessions?: unknown[];
  mapState?: Record<string, unknown>;
};

type SessionRouteBody = {
  applicationId?: string | null;
  archive?: TravelSessionArchive;
};

type TravelItinerarySessionRow = {
  id: string;
  conversation_memory_json: Json;
  itinerary_json: Json;
  map_state_json: Json;
  card_state_json: Json;
  updated_at: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseArchive(value: unknown): TravelSessionArchive | null {
  if (!isRecord(value) || typeof value.version !== "number") return null;
  return {
    version: value.version,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
    sessions: Array.isArray(value.sessions) ? value.sessions : [],
    mapState: isRecord(value.mapState) ? value.mapState : undefined,
  };
}

function parseBody(value: unknown): SessionRouteBody {
  if (!isRecord(value)) return {};
  return {
    applicationId:
      typeof value.applicationId === "string" ? value.applicationId : null,
    archive: parseArchive(value.archive) ?? undefined,
  };
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function archiveFromRow(row: TravelItinerarySessionRow): TravelSessionArchive | null {
  const memory = row.conversation_memory_json;
  if (!isRecord(memory)) return null;
  const archive = parseArchive(memory.archive);
  if (!archive) return null;

  const mapState = isRecord(row.map_state_json)
    ? (row.map_state_json as Record<string, unknown>)
    : undefined;

  return {
    ...archive,
    mapState: archive.mapState ?? mapState,
  };
}

async function findArchiveRow(
  userId: string,
  applicationId: string | null
): Promise<TravelItinerarySessionRow | null> {
  const admin = createAdminClient();
  let query = admin
    .from("travel_itinerary_sessions")
    .select(
      "id, conversation_memory_json, itinerary_json, map_state_json, card_state_json, updated_at"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  query = applicationId
    ? query.eq("application_id", applicationId)
    : query.is("application_id", null);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data as TravelItinerarySessionRow | null;
}

export async function GET(request: Request) {
  const session = await getUserFromSupabaseSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const applicationId = url.searchParams.get("applicationId");

  try {
    const row = await findArchiveRow(session.userId, applicationId);
    return Response.json(
      {
        archive: row ? archiveFromRow(row) : null,
        updatedAt: row?.updated_at ?? null,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Travel session archive unavailable.";
    return Response.json({ error: message }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const session = await getUserFromSupabaseSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = parseBody(await request.json().catch(() => ({})));
  if (!body.archive) {
    return Response.json({ error: "archive is required." }, { status: 400 });
  }

  const applicationId = body.applicationId ?? null;
  const archive = body.archive;
  const updatedAt = new Date().toISOString();

  try {
    const admin = createAdminClient();
    const existing = await findArchiveRow(session.userId, applicationId);
    const payload = {
      user_id: session.userId,
      application_id: applicationId,
      conversation_memory_json: toJson({
        archive,
        saved_at: updatedAt,
      }),
      itinerary_json: toJson({
        sessions: archive.sessions ?? [],
        active_version_count: archive.sessions?.length ?? 0,
      }),
      map_state_json: toJson(archive.mapState ?? {}),
      card_state_json: toJson({
        archive_version: archive.version,
        updated_at: archive.updatedAt ?? updatedAt,
      }),
      updated_at: updatedAt,
    };

    if (existing) {
      const { error } = await admin
        .from("travel_itinerary_sessions")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin
        .from("travel_itinerary_sessions")
        .insert(payload);
      if (error) throw new Error(error.message);
    }

    return Response.json({ ok: true, updatedAt }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save travel session archive.";
    return Response.json({ error: message }, { status: 503 });
  }
}

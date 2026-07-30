import { getUserFromSupabaseSession } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type TravelPreferenceItem = {
  id: string;
  key: string;
  value: string;
  created_at: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseItems(value: unknown): TravelPreferenceItem[] {
  if (!isRecord(value) || !Array.isArray(value.items)) return [];
  return value.items.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.key !== "string" ||
      typeof item.value !== "string"
    ) {
      return [];
    }
    return [
      {
        id: item.id,
        key: item.key,
        value: item.value,
        created_at:
          typeof item.created_at === "string" ? item.created_at : "",
      },
    ];
  });
}

async function readPreferences(userId: string): Promise<TravelPreferenceItem[]> {
  const { data, error } = await createAdminClient()
    .from("travel_user_preferences")
    .select("preferences_json")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return parseItems(data?.preferences_json);
}

export async function GET() {
  const auth = await getUserFromSupabaseSession();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(
      { preferences: await readPreferences(auth.userId) },
      { status: 200 }
    );
  } catch {
    return Response.json(
      { error: "Travel preferences are temporarily unavailable." },
      { status: 503 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await getUserFromSupabaseSession();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  try {
    const admin = createAdminClient();
    if (!id) {
      const { error } = await admin
        .from("travel_user_preferences")
        .delete()
        .eq("user_id", auth.userId);
      if (error) throw new Error(error.message);
      return Response.json({ ok: true, preferences: [] }, { status: 200 });
    }

    const items = (await readPreferences(auth.userId)).filter(
      (item) => item.id !== id
    );
    const { error } = await admin
      .from("travel_user_preferences")
      .upsert(
        {
          user_id: auth.userId,
          preferences_json: { items } as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (error) throw new Error(error.message);
    return Response.json({ ok: true, preferences: items }, { status: 200 });
  } catch {
    return Response.json(
      { error: "Travel preferences could not be updated." },
      { status: 503 }
    );
  }
}

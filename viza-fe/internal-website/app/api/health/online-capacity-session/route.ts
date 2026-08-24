import { createClient } from "@/lib/supabase/server";

interface CapacitySessionProbe {
  valid: boolean;
  sessionKind: "supabase" | null;
  userId: string | null;
  syntheticAccount: boolean;
}

function disabledResponse(status: number) {
  return Response.json(
    {
      valid: false,
      sessionKind: null,
      userId: null,
      syntheticAccount: false,
    } satisfies CapacitySessionProbe,
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

/**
 * Read-only proof that the capacity cookie belongs to a dedicated synthetic
 * Supabase user. This route deliberately bypasses the normal client-session
 * continuity/profile helpers because those helpers may write recovery state.
 */
export async function GET() {
  if (process.env.ONLINE_CAPACITY_TARGET_ENABLED?.trim() !== "true") {
    return disabledResponse(404);
  }

  try {
    const supabase = await createClient({ requestTimeoutMs: 1_500 });
    const { data, error } = await supabase.auth.getUser();
    const user = error ? null : data.user;
    const syntheticAccount = user?.email?.toLowerCase().endsWith("@viza.test") === true;
    if (!user || !syntheticAccount) return disabledResponse(401);

    return Response.json(
      {
        valid: true,
        sessionKind: "supabase",
        userId: user.id,
        syntheticAccount: true,
      } satisfies CapacitySessionProbe,
      { status: 200, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return disabledResponse(503);
  }
}

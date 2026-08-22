import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createPhEtravelSyntheticFixtureDraft,
  isPhEtravelSyntheticFixtureRequestAllowed,
  normalizePhEtravelSyntheticFixtureTransport,
} from "@/features/ph-etravel/synthetic-fixture";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json(
      { ok: false, code: "not_authenticated" },
      { status: 401 }
    );
  }

  const gate = isPhEtravelSyntheticFixtureRequestAllowed({
    env: process.env,
    userEmail: auth.user.email,
    authorizationHeader: request.headers.get("authorization"),
    nodeEnv: process.env.NODE_ENV,
  });
  if (!gate.allowed) {
    return NextResponse.json(
      { ok: false, code: gate.code },
      { status: gate.status }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid_json" },
      { status: 400 }
    );
  }

  const transportType = normalizePhEtravelSyntheticFixtureTransport(
    typeof body === "object" && body !== null
      ? (body as { transportType?: unknown }).transportType
      : null
  );
  if (!transportType) {
    return NextResponse.json(
      { ok: false, code: "invalid_transport_type" },
      { status: 400 }
    );
  }

  const result = await createPhEtravelSyntheticFixtureDraft({
    authUserId: auth.user.id,
    transportType,
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      applicationId: result.applicationId,
      country: "philippines",
      visaType: "PH_ETRAVEL_ARRIVAL_CARD",
      transportType: result.transportType,
    },
    { status: 201 }
  );
}

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  APPLICATION_ANSWERS_EVENT,
  type ApplicationAnswersEvent,
} from "@/lib/resilience/application-answers";
import { decryptResilienceValue, verifyReplaySignature } from "@/lib/resilience/gateway";

export const runtime = "nodejs";

type ReplayItem = {
  idempotencyKey?: unknown;
  eventType?: unknown;
  blob?: unknown;
  attempts?: unknown;
  leaseId?: unknown;
};

type ReplayRequest = { items?: unknown };
type ReplayResult = {
  idempotencyKey: string;
  leaseId?: string;
  outcome: "ack" | "nack";
  errorCode?: string;
  retryAfterSeconds?: number;
};

type ReplayRpcClient = {
  rpc(
    name: "replay_resilient_application_answers",
    params: {
      p_application_id: string;
      p_applicant_id: string;
      p_saved_at: string;
      p_answers: Record<string, string>;
    },
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

function isApplicationAnswersEvent(value: unknown): value is ApplicationAnswersEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<ApplicationAnswersEvent>;
  return (
    event.version === 1 &&
    typeof event.applicantId === "string" &&
    typeof event.applicationId === "string" &&
    typeof event.savedAt === "string" &&
    Number.isFinite(Date.parse(event.savedAt)) &&
    Boolean(event.answers) &&
    typeof event.answers === "object" &&
    !Array.isArray(event.answers) &&
    Object.keys(event.answers).length <= 500 &&
    Object.entries(event.answers).every(
      ([fieldName, answer]) => fieldName.trim().length > 0 && typeof answer === "string",
    )
  );
}

async function replayApplicationAnswers(event: ApplicationAnswersEvent): Promise<ReplayResult["errorCode"]> {
  const admin = createAdminClient({
    requestTimeoutMs: 6_000,
    retryDelaysMs: [],
  }) as unknown as ReplayRpcClient;
  const { error } = await admin.rpc("replay_resilient_application_answers", {
    p_application_id: event.applicationId,
    p_applicant_id: event.applicantId,
    p_saved_at: event.savedAt,
    p_answers: event.answers,
  });
  if (!error) return undefined;
  const normalized = error.message.toLowerCase();
  if (normalized.includes("ownership check failed")) return "ownership_rejected";
  throw new Error(error.message);
}

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  if (!verifyReplaySignature(request, rawBody)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: ReplayRequest;
  try {
    payload = JSON.parse(rawBody) as ReplayRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!Array.isArray(payload.items) || payload.items.length > 50) {
    return NextResponse.json({ error: "invalid_batch" }, { status: 400 });
  }

  const results: ReplayResult[] = [];
  for (const rawItem of payload.items) {
    const item = rawItem as ReplayItem;
    const idempotencyKey = typeof item.idempotencyKey === "string" ? item.idempotencyKey : "";
    const leaseId = typeof item.leaseId === "string" ? item.leaseId : undefined;
    if (!idempotencyKey || typeof item.eventType !== "string" || typeof item.blob !== "string") {
      if (idempotencyKey) results.push({ idempotencyKey, leaseId, outcome: "ack", errorCode: "invalid_event" });
      continue;
    }
    if (item.eventType !== APPLICATION_ANSWERS_EVENT) {
      results.push({ idempotencyKey, leaseId, outcome: "ack", errorCode: "unsupported_event" });
      continue;
    }

    try {
      const event = decryptResilienceValue<unknown>(item.blob);
      if (!isApplicationAnswersEvent(event)) {
        results.push({ idempotencyKey, leaseId, outcome: "ack", errorCode: "invalid_event" });
        continue;
      }
      const rejected = await replayApplicationAnswers(event);
      results.push({
        idempotencyKey,
        leaseId,
        outcome: "ack",
        ...(rejected ? { errorCode: rejected } : {}),
      });
    } catch (error) {
      console.error("Resilience event replay deferred", {
        idempotencyKey,
        eventType: item.eventType,
        error: error instanceof Error ? error.message : String(error),
      });
      results.push({
        idempotencyKey,
        leaseId,
        outcome: "nack",
        errorCode: "provider_unavailable",
        retryAfterSeconds: 30,
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}

import { isFormAssistantEnabled } from "@/lib/form-assistant/constants";
import { consumeFormAssistantRateLimit } from "@/lib/form-assistant/rate-limit";
import {
  loadAssistantAnswers,
  loadAssistantSchema,
  requireOwnedApplication,
} from "@/lib/form-assistant/server-context";
import { validateApplicationAnswers } from "@/lib/form-assistant/validator";

export const runtime = "nodejs";

type AcknowledgeBody = { validationId?: unknown; warningCodes?: unknown };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const owned = await requireOwnedApplication(id);
  if ("error" in owned) return Response.json({ error: owned.error }, { status: owned.status });
  if (!consumeFormAssistantRateLimit(`acknowledge:${owned.user.id}`, { limit: 30, windowMs: 60_000 })) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }
  if (process.env.FORM_ASSISTANT_ENABLED === "false" || !isFormAssistantEnabled(owned.application.visa_type)) {
    return Response.json({ error: "Form assistant is not enabled for this application." }, { status: 404 });
  }
  let body: AcknowledgeBody;
  try {
    body = await request.json() as AcknowledgeBody;
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }
  const validationId = typeof body.validationId === "string" ? body.validationId : "";
  const warningCodes = Array.isArray(body.warningCodes)
    ? body.warningCodes.filter((value): value is string => typeof value === "string").slice(0, 50)
    : [];
  if (!validationId) return Response.json({ error: "validationId is required." }, { status: 400 });

  const { data: session } = await owned.admin
    .from("form_assistant_sessions")
    .select("id, last_check_json, knowledge_release_key")
    .eq("application_id", id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const validation = session?.last_check_json as {
    validationId?: string;
    errors?: unknown[];
    warnings?: Array<{ code?: string }>;
  } | null;
  if (!session || validation?.validationId !== validationId) {
    return Response.json({ error: "Validation is stale. Run the final check again." }, { status: 409 });
  }
  if ((validation.errors?.length ?? 0) > 0) {
    return Response.json({ error: "Validation errors must be fixed before review." }, { status: 409 });
  }
  const [steps, answerRows] = await Promise.all([
    loadAssistantSchema(owned.admin, owned.application.country, owned.application.visa_type),
    loadAssistantAnswers(owned.admin, id, {
      applicantId: owned.application.applicant_id,
      authUserId: owned.user.id,
    }),
  ]);
  const currentCheck = validateApplicationAnswers({
    steps,
    answers: Object.fromEntries(Object.entries(answerRows).map(([key, item]) => [key, item.value])),
    visaType: owned.application.visa_type,
  });
  if (currentCheck.errors.length > 0) {
    return Response.json({ error: "Answers changed and must be checked again." }, { status: 409 });
  }
  const expectedCodes = (validation.warnings ?? []).map((warning) => warning.code).filter(Boolean) as string[];
  const currentCodes = currentCheck.warnings.map((warning) => warning.code);
  if (
    expectedCodes.some((code) => !warningCodes.includes(code))
    || expectedCodes.length !== currentCodes.length
    || expectedCodes.some((code) => !currentCodes.includes(code))
  ) {
    return Response.json({ error: "All warnings must be handled before review." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const eventKey = `form-assistant-warning-ack:${id}:${validationId}`;
  const { error } = await owned.admin.from("application_events").upsert({
    application_id: id,
    applicant_id: owned.application.applicant_id,
    auth_user_id: owned.user.id,
    event_type: "form_assistant_warnings_acknowledged",
    actor_type: "applicant",
    actor_id: owned.user.id,
    source: "form_assistant",
    visibility: "applicant",
    idempotency_key: eventKey,
    message: "Applicant acknowledged form-assistant validation warnings.",
    metadata: {
      validationId,
      warningCodes,
      knowledgeRelease: session.knowledge_release_key,
      acknowledgedAt: now,
    },
    occurred_at: now,
  }, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (error) return Response.json({ error: "Unable to save warning acknowledgement." }, { status: 500 });
  await owned.admin
    .from("form_assistant_sessions")
    .update({ status: "completed", completed_at: now, updated_at: now })
    .eq("id", session.id);
  return Response.json({ canReview: true });
}

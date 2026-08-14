import { randomUUID } from "node:crypto";
import { isFormAssistantEnabled } from "@/lib/form-assistant/constants";
import { consumeFormAssistantRateLimit } from "@/lib/form-assistant/rate-limit";
import {
  loadAssistantAnswers,
  loadAssistantSchema,
  requireOwnedApplication,
} from "@/lib/form-assistant/server-context";
import { getOrCreateAssistantSession, runAssistantTurn } from "@/lib/form-assistant/service";
import { FORM_ASSISTANT_PROVIDERS_UNAVAILABLE_CODE } from "@/types/form-assistant";

export const runtime = "nodejs";

type TurnBody = {
  message?: unknown;
  locale?: unknown;
  inputMode?: unknown;
  idempotencyKey?: unknown;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const owned = await requireOwnedApplication(id);
  if ("error" in owned) return Response.json({ error: owned.error }, { status: owned.status });
  if (process.env.FORM_ASSISTANT_ENABLED === "false" || !isFormAssistantEnabled(owned.application.visa_type)) {
    return Response.json({ error: "Form assistant is not enabled for this application." }, { status: 404 });
  }
  if (!consumeFormAssistantRateLimit(`turn:${owned.user.id}`, { limit: 30, windowMs: 60_000 })) {
    return Response.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  let body: TurnBody;
  try {
    body = await request.json() as TurnBody;
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }
  if (typeof body.message !== "string" || !body.message.trim()) {
    return Response.json({ error: "message is required." }, { status: 400 });
  }
  const locale = typeof body.locale === "string" ? body.locale : "en";

  try {
    // Answers are deliberately re-read immediately before proposing and
    // applying patches so a concurrent manual form save always wins.
    const [steps, answers] = await Promise.all([
      loadAssistantSchema(owned.admin, owned.application.country, owned.application.visa_type),
      loadAssistantAnswers(owned.admin, id, {
        applicantId: owned.application.applicant_id,
        authUserId: owned.user.id,
      }),
    ]);
    const session = await getOrCreateAssistantSession({
      admin: owned.admin,
      applicationId: id,
      applicantId: owned.application.applicant_id,
      authUserId: owned.user.id,
      country: owned.application.country,
      visaType: owned.application.visa_type,
      steps,
    });
    const response = await runAssistantTurn({
      admin: owned.admin,
      session,
      applicationId: id,
      applicantId: owned.application.applicant_id,
      authUserId: owned.user.id,
      steps,
      answers,
      text: body.message,
      locale,
      inputMode: body.inputMode === "voice" ? "voice" : "text",
      idempotencyKey: typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.slice(0, 128)
        : randomUUID(),
      country: owned.application.country,
      visaType: owned.application.visa_type,
    });
    return Response.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "FORM_ASSISTANT_TURN_IN_PROGRESS") {
      return Response.json({ error: "This message is already being processed." }, { status: 409 });
    }
    if (error instanceof Error && error.message === FORM_ASSISTANT_PROVIDERS_UNAVAILABLE_CODE) {
      return Response.json({
        code: FORM_ASSISTANT_PROVIDERS_UNAVAILABLE_CODE,
        error: "The AI service is temporarily unavailable.",
      }, { status: 503 });
    }
    console.error("[form-assistant] Turn failed", error);
    return Response.json({ error: "The assistant could not process this message." }, { status: 500 });
  }
}

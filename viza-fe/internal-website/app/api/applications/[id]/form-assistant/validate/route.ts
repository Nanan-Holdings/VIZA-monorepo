import { randomUUID } from "node:crypto";
import { isFormAssistantEnabled } from "@/lib/form-assistant/constants";
import { consumeFormAssistantRateLimit } from "@/lib/form-assistant/rate-limit";
import {
  loadAssistantAnswers,
  loadAssistantSchema,
  requireOwnedApplication,
} from "@/lib/form-assistant/server-context";
import { getOrCreateAssistantSession } from "@/lib/form-assistant/service";
import { validateApplicationAnswers } from "@/lib/form-assistant/validator";
import type { FormAssistantValidationResponse } from "@/types/form-assistant";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const owned = await requireOwnedApplication(id);
  if ("error" in owned) return Response.json({ error: owned.error }, { status: owned.status });
  if (!consumeFormAssistantRateLimit(`validate:${owned.user.id}`, { limit: 30, windowMs: 60_000 })) {
    return Response.json({ error: "Too many validation requests." }, { status: 429 });
  }
  if (process.env.FORM_ASSISTANT_ENABLED === "false" || !isFormAssistantEnabled(owned.application.visa_type)) {
    return Response.json({ error: "Form assistant is not enabled for this application." }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({})) as { locale?: unknown };
    const locale = typeof body.locale === "string" ? body.locale : "en";
    const [steps, answerRows] = await Promise.all([
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
    const answers = Object.fromEntries(Object.entries(answerRows).map(([key, item]) => [key, item.value]));
    const result = validateApplicationAnswers({ steps, answers, visaType: owned.application.visa_type, locale });
    const validationId = randomUUID();
    const response: FormAssistantValidationResponse = {
      ...result,
      canReview: result.errors.length === 0 && result.warnings.length === 0,
      validationId,
    };
    await owned.admin
      .from("form_assistant_sessions")
      .update({ last_check_json: response, updated_at: new Date().toISOString() })
      .eq("id", session.id);
    return Response.json(response);
  } catch (error) {
    console.error("[form-assistant] Validation failed", error);
    return Response.json({ error: "Unable to validate this application." }, { status: 500 });
  }
}

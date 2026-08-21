import { randomUUID } from "node:crypto";
import { isFormAssistantEnabled } from "@/lib/form-assistant/constants";
import { consumeFormAssistantRateLimit } from "@/lib/form-assistant/rate-limit";
import {
  loadAssistantAnswers,
  loadAssistantSchema,
  requireOwnedApplication,
} from "@/lib/form-assistant/server-context";
import { formAssistantTimeZone, getOrCreateAssistantSession } from "@/lib/form-assistant/service";
import {
  canonicalizeApplicationOptionAnswers,
  validateApplicationAnswers,
} from "@/lib/form-assistant/validator";
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
    const loadedAnswers = Object.fromEntries(Object.entries(answerRows).map(([key, item]) => [key, item.value]));
    const { answers, patches } = canonicalizeApplicationOptionAnswers(steps, loadedAnswers);
    if (patches.length > 0) {
      const updatedAt = new Date().toISOString();
      const results = await Promise.all(patches.map((patch) =>
        owned.admin
          .from("visa_application_answers")
          .update({ value_text: patch.value, updated_at: updatedAt })
          .eq("application_id", id)
          .eq("field_name", patch.fieldName)
          .eq("value_text", patch.previousValue)
      ));
      const canonicalizationError = results.find((item) => item.error)?.error;
      if (canonicalizationError) throw new Error(canonicalizationError.message);
    }
    const result = validateApplicationAnswers({
      steps,
      answers,
      visaType: owned.application.visa_type,
      timeZone: formAssistantTimeZone(owned.application.country, owned.application.visa_type),
      locale,
    });
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

import { isFormAssistantEnabled } from "@/lib/form-assistant/constants";
import { consumeFormAssistantRateLimit } from "@/lib/form-assistant/rate-limit";
import {
  loadAssistantAnswers,
  loadAssistantSchema,
  requireOwnedApplication,
} from "@/lib/form-assistant/server-context";
import {
  buildAssistantState,
  getOrCreateAssistantSession,
  loadAssistantMessages,
} from "@/lib/form-assistant/service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const owned = await requireOwnedApplication(id);
  if ("error" in owned) return Response.json({ error: owned.error }, { status: owned.status });
  if (!consumeFormAssistantRateLimit(`state:${owned.user.id}`, { limit: 120, windowMs: 60_000 })) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }
  if (process.env.FORM_ASSISTANT_ENABLED === "false" || !isFormAssistantEnabled(owned.application.visa_type)) {
    return Response.json({ error: "Form assistant is not enabled for this application." }, { status: 404 });
  }

  try {
    const locale = new URL(request.url).searchParams.get("locale") ?? "en";
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
    const messages = await loadAssistantMessages(owned.admin, session.id);
    return Response.json(buildAssistantState({
      sessionId: session.id,
      steps,
      answers,
      messages,
      locale,
    }));
  } catch (error) {
    console.error("[form-assistant] Failed to load state", error);
    return Response.json({ error: "Unable to load the form assistant." }, { status: 500 });
  }
}

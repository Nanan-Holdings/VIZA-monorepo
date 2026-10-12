import { isFormAssistantEnabled } from "@/lib/form-assistant/constants";
import { consumeFormAssistantRateLimit } from "@/lib/form-assistant/rate-limit";
import {
  loadAssistantAnswers,
  loadAssistantDocumentReadiness,
  loadAssistantSchema,
  repairAssistantOfficialOptionAnswers,
  requireOwnedApplication,
} from "@/lib/form-assistant/server-context";
import {
  buildAssistantState,
  getOrCreateAssistantSession,
  loadAssistantSession,
  loadAssistantMessages,
} from "@/lib/form-assistant/service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const owned = await requireOwnedApplication(id, { allowSuccessfulSubmission: true });
  if ("error" in owned) return Response.json({ error: owned.error }, { status: owned.status });
  if (!consumeFormAssistantRateLimit(`state:${owned.user.id}`, { limit: 120, windowMs: 60_000 })) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }
  if (process.env.FORM_ASSISTANT_ENABLED === "false" || !isFormAssistantEnabled(owned.application.visa_type)) {
    return Response.json({ error: "Form assistant is not enabled for this application." }, { status: 404 });
  }

  try {
    const locale = new URL(request.url).searchParams.get("locale") ?? "en";
    const [steps, answerRows, documentReadiness] = await Promise.all([
      loadAssistantSchema(owned.admin, owned.application.country, owned.application.visa_type),
      loadAssistantAnswers(
        owned.admin,
        id,
        owned.formAssistantReadOnly
          ? {}
          : {
              applicantId: owned.application.applicant_id,
              authUserId: owned.user.id,
            },
      ),
      loadAssistantDocumentReadiness({
        applicationId: id,
        country: owned.application.country,
        visaType: owned.application.visa_type,
      }).catch((error) => {
        console.warn("[form-assistant] Document readiness lookup failed", error);
        return null;
      }),
    ]);
    const answers = owned.formAssistantReadOnly
      ? answerRows
      : await repairAssistantOfficialOptionAnswers(
          owned.admin,
          id,
          steps,
          answerRows,
        );
    const session = owned.formAssistantReadOnly
      ? await loadAssistantSession(owned.admin, id)
      : await getOrCreateAssistantSession({
          admin: owned.admin,
          applicationId: id,
          applicantId: owned.application.applicant_id,
          authUserId: owned.user.id,
          country: owned.application.country,
          visaType: owned.application.visa_type,
          steps,
        });
    const messages = session
      ? await loadAssistantMessages(owned.admin, session.id)
      : [];
    return Response.json(buildAssistantState({
      sessionId: session?.id ?? `read-only-${id}`,
      country: owned.application.country,
      visaType: owned.application.visa_type,
      steps,
      answers,
      messages,
      locale,
      documentReadiness,
    }));
  } catch (error) {
    console.error("[form-assistant] Failed to load state", error);
    return Response.json({ error: "Unable to load the form assistant." }, { status: 500 });
  }
}

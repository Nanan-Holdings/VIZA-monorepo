import { isFormAssistantEnabled } from "@/lib/form-assistant/constants";
import { consumeFormAssistantRateLimit } from "@/lib/form-assistant/rate-limit";
import { requireOwnedApplication } from "@/lib/form-assistant/server-context";
import type {
  FormAssistantUndoPatch,
  FormAssistantUndoResponse,
} from "@/types/form-assistant";

export const runtime = "nodejs";

type UndoBody = {
  patches?: unknown;
};

function readPatches(value: unknown): FormAssistantUndoPatch[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { fieldName?: unknown; value?: unknown };
    if (
      typeof candidate.fieldName !== "string" ||
      !candidate.fieldName.trim() ||
      typeof candidate.value !== "string"
    ) return [];
    return [{
      fieldName: candidate.fieldName.trim().slice(0, 160),
      value: candidate.value.slice(0, 4_000),
    }];
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const owned = await requireOwnedApplication(id);
  if ("error" in owned) return Response.json({ error: owned.error }, { status: owned.status });
  if (
    process.env.FORM_ASSISTANT_ENABLED === "false" ||
    !isFormAssistantEnabled(owned.application.visa_type)
  ) {
    return Response.json({ error: "Form assistant is not enabled for this application." }, { status: 404 });
  }
  if (!consumeFormAssistantRateLimit(`undo:${owned.user.id}`, { limit: 20, windowMs: 60_000 })) {
    return Response.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  let body: UndoBody;
  try {
    body = await request.json() as UndoBody;
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }
  const patches = readPatches(body.patches);
  if (patches.length === 0) {
    return Response.json({ error: "At least one assistant patch is required." }, { status: 400 });
  }

  const response: FormAssistantUndoResponse = { restored: [], skippedConflicts: [] };
  for (const patch of patches) {
    const { data: current, error: readError } = await owned.admin
      .from("visa_application_answers")
      .select("field_name, value_text, source, source_metadata")
      .eq("application_id", id)
      .eq("field_name", patch.fieldName)
      .maybeSingle();
    if (
      readError ||
      !current ||
      current.source !== "form_assistant" ||
      current.value_text !== patch.value
    ) {
      response.skippedConflicts.push(patch.fieldName);
      continue;
    }

    const metadata = current.source_metadata && typeof current.source_metadata === "object"
      ? current.source_metadata as Record<string, unknown>
      : {};
    const previousValue = typeof metadata.previousValue === "string"
      ? metadata.previousValue
      : null;
    if (previousValue !== null) {
      const { data, error } = await owned.admin
        .from("visa_application_answers")
        .update({
          value_text: previousValue,
          source_metadata: {
            sourceKind: "user_chat",
            confidence: "high",
            restoredBy: "form_assistant_undo",
            restoredAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("application_id", id)
        .eq("field_name", patch.fieldName)
        .eq("source", "form_assistant")
        .eq("value_text", patch.value)
        .select("field_name")
        .maybeSingle();
      if (error || !data) {
        response.skippedConflicts.push(patch.fieldName);
        continue;
      }
      response.restored.push({
        fieldName: patch.fieldName,
        restoredValue: previousValue,
        restoredSource: "form_assistant",
      });
      continue;
    }

    const { data, error } = await owned.admin
      .from("visa_application_answers")
      .delete()
      .eq("application_id", id)
      .eq("field_name", patch.fieldName)
      .eq("source", "form_assistant")
      .eq("value_text", patch.value)
      .select("field_name")
      .maybeSingle();
    if (error || !data) {
      response.skippedConflicts.push(patch.fieldName);
      continue;
    }
    response.restored.push({
      fieldName: patch.fieldName,
      restoredValue: null,
      restoredSource: null,
    });
  }

  return Response.json(response);
}

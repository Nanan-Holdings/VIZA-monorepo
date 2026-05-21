"use server";

import * as path from "node:path";
import * as fs from "node:fs/promises";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface QuestionFieldRecord {
  field_name: string;
  label: string;
  widget_type: string;
  required: boolean;
  options?: Array<{ value: string; text: string }> | null;
  branch?: { when: { field: string; equals: string } } | null;
  ordinal: number;
}

export interface QuestionSetRecord {
  country: string;
  visa_type: string;
  version: string;
  fields: QuestionFieldRecord[];
}

interface SnapshotShape {
  country: string;
  visa_type: string;
  version: string;
  fields: QuestionFieldRecord[];
}

async function loadFromSnapshot(country: string): Promise<SnapshotShape | null> {
  const candidate = path.resolve(
    process.cwd(),
    "..",
    "..",
    "db",
    "seeds",
    "question-sets",
    `${country.toLowerCase()}.json`,
  );
  try {
    const raw = await fs.readFile(candidate, "utf8");
    return JSON.parse(raw) as SnapshotShape;
  } catch {
    return null;
  }
}

export async function loadQuestionSetForApplication(
  applicationId: string,
): Promise<{ set?: QuestionSetRecord; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminClient = createAdminClient();
  const { data: app } = await adminClient
    .from("applications")
    .select("id, country, visa_type, applicant_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { error: "Application not found" };

  const { data: profile } = await adminClient
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile || profile.id !== app.applicant_id) {
    return { error: "Unauthorized" };
  }

  const country = (app.country as string).toUpperCase();
  const visaType = app.visa_type as string;

  const { data: setRow } = await adminClient
    .from("question_set")
    .select("id, version")
    .eq("country", country)
    .eq("visa_type", visaType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (setRow) {
    const { data: fieldRows } = await adminClient
      .from("question_field")
      .select("field_name, label, widget_type, required, options, branch, ordinal")
      .eq("question_set_id", setRow.id)
      .order("ordinal", { ascending: true });
    if (fieldRows && fieldRows.length > 0) {
      return {
        set: {
          country,
          visa_type: visaType,
          version: setRow.version,
          fields: fieldRows.map((r) => ({
            field_name: r.field_name as string,
            label: r.label as string,
            widget_type: r.widget_type as string,
            required: r.required as boolean,
            options: (r.options ?? null) as QuestionFieldRecord["options"],
            branch: (r.branch ?? null) as QuestionFieldRecord["branch"],
            ordinal: (r.ordinal ?? 0) as number,
          })),
        },
      };
    }
  }

  const snapshot = await loadFromSnapshot(country);
  if (!snapshot) return { error: `No question set for ${country}/${visaType}` };
  return {
    set: {
      country: snapshot.country.toUpperCase(),
      visa_type: snapshot.visa_type,
      version: snapshot.version,
      fields: snapshot.fields,
    },
  };
}

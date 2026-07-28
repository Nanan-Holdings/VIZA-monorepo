"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cropToSpec, type PhotoSpec, type CropRegion } from "@/lib/photo/crop";

const STORAGE_BUCKET = "application-documents";

export interface PhotoCropResult {
  ok: boolean;
  croppedStoragePath?: string;
  width?: number;
  height?: number;
  reason?: string;
}

async function loadPhotoSpec(country: string, visaType: string): Promise<PhotoSpec | null> {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("photo_spec")
    .select("country, visa_type, width_mm, height_mm, dpi, eyeline_from_top, head_height_pct, background_hex")
    .eq("country", country.toUpperCase())
    .eq("visa_type", visaType)
    .maybeSingle();
  if (!data) return null;
  return {
    country: data.country as string,
    visaType: data.visa_type as string,
    widthMm: Number(data.width_mm),
    heightMm: Number(data.height_mm),
    dpi: Number(data.dpi),
    eyelineFromTop: data.eyeline_from_top ? Number(data.eyeline_from_top) : null,
    headHeightPct: data.head_height_pct ? Number(data.head_height_pct) : null,
    backgroundHex: (data.background_hex as string | null) ?? null,
  };
}

export async function processApplicantPhoto(args: {
  applicationId: string;
  /** Crop region in source pixels; falls back to centered aspect crop. */
  cropRegion?: CropRegion;
}): Promise<PhotoCropResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Not authenticated" };

  const adminClient = createAdminClient();
  const { data: app } = await adminClient
    .from("applications")
    .select("id, applicant_id, country, visa_type")
    .eq("id", args.applicationId)
    .maybeSingle();
  if (!app) return { ok: false, reason: "Application not found" };

  const { data: profile } = await adminClient
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile || profile.id !== app.applicant_id) {
    return { ok: false, reason: "Unauthorized" };
  }

  const spec = await loadPhotoSpec(app.country as string, app.visa_type as string);
  if (!spec) {
    return { ok: false, reason: `No photo_spec for ${app.country}/${app.visa_type}` };
  }

  const { data: original } = await adminClient
    .from("application_documents")
    .select("storage_path")
    .eq("application_id", args.applicationId)
    .eq("document_type", "applicant_photo")
    .maybeSingle();
  if (!original?.storage_path) return { ok: false, reason: "Original photo not uploaded" };

  const { data: blob, error: dlError } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .download(original.storage_path);
  if (dlError || !blob) return { ok: false, reason: dlError?.message || "download failed" };
  const arrayBuffer = await blob.arrayBuffer();
  const sourceBuffer = Buffer.from(arrayBuffer);

  let cropped;
  try {
    cropped = await cropToSpec(sourceBuffer, spec, args.cropRegion);
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "crop failed" };
  }

  const croppedPath = original.storage_path.replace(/(\.[^.]+)?$/, ".cropped.jpg");
  const { error: upError } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .upload(croppedPath, cropped.buffer, {
      upsert: true,
      contentType: "image/jpeg",
      cacheControl: "3600",
    });
  if (upError) return { ok: false, reason: upError.message };

  await adminClient
    .from("application_documents")
    .upsert(
      {
        application_id: args.applicationId,
        document_type: "applicant_photo_cropped",
        storage_path: croppedPath,
        filename: `${args.applicationId}-photo-cropped.jpg`,
        status: "uploaded",
        rejection_reason: null,
        metadata: {
          source_path: original.storage_path,
          spec: { country: spec.country, visa_type: spec.visaType, dpi: spec.dpi },
          target_width_px: cropped.targetWidthPx,
          target_height_px: cropped.targetHeightPx,
          crop_region: cropped.region,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "application_id,document_type" },
    );

  return {
    ok: true,
    croppedStoragePath: croppedPath,
    width: cropped.targetWidthPx,
    height: cropped.targetHeightPx,
  };
}

export async function getPhotoSpecForApplication(
  applicationId: string,
): Promise<{ spec?: PhotoSpec; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminClient = createAdminClient();
  const { data: app } = await adminClient
    .from("applications")
    .select("country, visa_type, applicant_id")
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

  const spec = await loadPhotoSpec(app.country as string, app.visa_type as string);
  if (!spec) return { error: `No photo_spec for ${app.country}/${app.visa_type}` };
  return { spec };
}

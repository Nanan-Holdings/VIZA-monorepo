"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CatalogueReadiness, PublicCataloguePayload } from "@/lib/admin/catalogue";

export type CatalogueActionResult = { success: true; readiness?: CatalogueReadiness } | { success: false; error: string; readiness?: CatalogueReadiness };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FLAG_RE = /^[a-z]{2}$/;

function validatePayload(payload: PublicCataloguePayload): string[] {
  const blockers: string[] = [];
  if (!SLUG_RE.test(payload.slug)) blockers.push("Marketing slug must use lowercase kebab-case.");
  if (!payload.portalCountry.trim()) blockers.push("Portal country is required.");
  if (!payload.name.trim()) blockers.push("Public name is required.");
  if (!payload.city.trim()) blockers.push("City/summary is required.");
  if (!FLAG_RE.test(payload.flagCode)) blockers.push("Flag code must be a lowercase ISO-2 code.");
  if (!payload.type.trim()) blockers.push("Public visa type label is required.");
  if (!payload.visaType.trim()) blockers.push("Portal visa type is required.");
  if (!payload.validity.trim()) blockers.push("Validity copy is required.");
  if (!payload.image.startsWith("/assets/heroes/")) blockers.push("Hero image must use a local /assets/heroes/ path.");
  for (const [key, value] of Object.entries(payload.pricing)) {
    if (key !== "currency" && (!Number.isInteger(value) || Number(value) < 0)) blockers.push(`${key} must be a non-negative minor-unit integer.`);
  }
  return blockers;
}

async function calculateReadiness(
  admin: ReturnType<typeof createAdminClient>,
  visaPackageId: string,
  payload: PublicCataloguePayload,
): Promise<CatalogueReadiness> {
  const [{ data: pkg }, pricing, fields, documents] = await Promise.all([
    admin.from("visa_packages").select("id, country, visa_type, name, is_active, metadata").eq("id", visaPackageId).maybeSingle(),
    admin.from("package_pricing").select("id, currency, government_fee_cents, agency_fee_cents, source, updated_at").eq("visa_package_id", visaPackageId),
    admin.from("visa_form_fields").select("id", { count: "exact", head: true }).eq("visa_type", payload.visaType),
    admin.from("document_requirements").select("id", { count: "exact", head: true }).eq("visa_package_id", visaPackageId),
  ]);
  const blockers = validatePayload(payload);
  const warnings: string[] = [];
  if (!pkg) blockers.push("Visa package does not exist.");
  else {
    if (!pkg.is_active) blockers.push("Visa package is inactive.");
    if (String(pkg.visa_type).toUpperCase() !== payload.visaType.toUpperCase()) blockers.push("Published visa type does not match the package visa type.");
    const coverage = typeof pkg.metadata === "object" && pkg.metadata !== null && !Array.isArray(pkg.metadata)
      ? (pkg.metadata as Record<string, unknown>).coverage
      : null;
    if (!coverage) warnings.push("Package coverage metadata is not explicit.");
  }
  if (pricing.error || !pricing.data?.length) blockers.push("No package_pricing row exists.");
  if (fields.error || !fields.count) blockers.push("No visa form fields exist for this visa type.");
  if (documents.error || !documents.count) blockers.push("No document requirements exist for this package.");
  if (payload.pricing.agencyFeeMinor === 0 && payload.pricing.governmentFeeMinor === 0) warnings.push("Public display price is free; confirm this is intentional.");
  const canonical = pricing.data?.[0];
  if (canonical && String(canonical.currency).toUpperCase() !== payload.pricing.currency) {
    warnings.push(`Canonical package pricing is ${canonical.currency}; the public display snapshot is SGD.`);
  }
  return {
    blockers,
    warnings,
    evidence: {
      packageActive: Boolean(pkg?.is_active),
      pricingRows: pricing.data?.length ?? 0,
      formFieldCount: fields.count ?? 0,
      documentRequirementCount: documents.count ?? 0,
      checkedAt: new Date().toISOString(),
    },
  };
}

export async function saveCatalogueDraft(input: {
  visaPackageId: string;
  payload: PublicCataloguePayload;
  reason: string;
}): Promise<CatalogueActionResult> {
  try {
    const actor = await requireRole("admin", "staff");
    if (input.reason.trim().length < 5) return { success: false, error: "A draft-change reason is required." };
    const admin = createAdminClient();
    const readiness = await calculateReadiness(admin, input.visaPackageId, input.payload);
    const { error } = await admin.rpc("save_catalogue_draft", {
      p_visa_package_id: input.visaPackageId,
      p_payload: input.payload,
      p_readiness: readiness,
      p_actor_user_id: actor.id,
      p_reason: input.reason.trim(),
    });
    if (error) return { success: false, error: error.message, readiness };
    revalidatePath("/admin/catalogue-publication");
    return { success: true, readiness };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to save catalogue draft" };
  }
}

export async function publishCatalogueEntry(input: { visaPackageId: string; reason: string }): Promise<CatalogueActionResult> {
  try {
    const actor = await requireRole("admin");
    if (input.reason.trim().length < 5) return { success: false, error: "A publication reason is required." };
    const admin = createAdminClient();
    const { data: before, error: readError } = await admin.from("catalogue_publications").select("*").eq("visa_package_id", input.visaPackageId).maybeSingle();
    if (readError || !before) return { success: false, error: readError?.message || "Save a draft before publishing." };
    const payload = before.draft_payload as PublicCataloguePayload;
    const readiness = await calculateReadiness(admin, input.visaPackageId, payload);
    if (readiness.blockers.length) return { success: false, error: "Readiness blockers must be resolved before publication.", readiness };
    const { error } = await admin.rpc("publish_catalogue_entry", {
      p_visa_package_id: input.visaPackageId,
      p_readiness: readiness,
      p_actor_user_id: actor.id,
      p_reason: input.reason.trim(),
    });
    if (error) return { success: false, error: error.message, readiness };
    revalidatePath("/admin/catalogue-publication");
    return { success: true, readiness };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to publish catalogue entry" };
  }
}

export async function retireCatalogueEntry(input: { visaPackageId: string; reason: string }): Promise<CatalogueActionResult> {
  try {
    const actor = await requireRole("admin");
    if (input.reason.trim().length < 5) return { success: false, error: "A retirement reason is required." };
    const admin = createAdminClient();
    const { data: before } = await admin.from("catalogue_publications").select("*").eq("visa_package_id", input.visaPackageId).maybeSingle();
    if (!before || before.status !== "published") return { success: false, error: "Only a published entry can be retired." };
    const { error } = await admin.rpc("retire_catalogue_entry", {
      p_visa_package_id: input.visaPackageId,
      p_actor_user_id: actor.id,
      p_reason: input.reason.trim(),
    });
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/catalogue-publication");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to retire catalogue entry" };
  }
}

function numberFromForm(formData: FormData, key: string): number {
  const raw = Number(formData.get(key));
  return Number.isFinite(raw) ? Math.round(raw) : -1;
}

export async function saveCatalogueDraftFromForm(
  _previous: CatalogueActionResult | null,
  formData: FormData,
): Promise<CatalogueActionResult> {
  return saveCatalogueDraft({
    visaPackageId: String(formData.get("visaPackageId") || ""),
    reason: String(formData.get("reason") || ""),
    payload: {
      slug: String(formData.get("slug") || "").trim(),
      portalCountry: String(formData.get("portalCountry") || "").trim(),
      name: String(formData.get("name") || "").trim(),
      city: String(formData.get("city") || "").trim(),
      flagCode: String(formData.get("flagCode") || "").trim().toLowerCase(),
      type: String(formData.get("type") || "").trim(),
      visaType: String(formData.get("visaType") || "").trim(),
      validity: String(formData.get("validity") || "").trim(),
      image: String(formData.get("image") || "").trim(),
      tag: formData.get("tag") === "evisa" ? "evisa" : "fast",
      featured: formData.get("featured") === "on",
      pricing: {
        currency: "SGD",
        governmentFeeMinor: numberFromForm(formData, "governmentFeeMinor"),
        agencyFeeMinor: numberFromForm(formData, "agencyFeeMinor"),
        firstTimeDiscountMinor: numberFromForm(formData, "firstTimeDiscountMinor"),
      },
    },
  });
}

export async function publishCatalogueEntryFromForm(
  _previous: CatalogueActionResult | null,
  formData: FormData,
): Promise<CatalogueActionResult> {
  return publishCatalogueEntry({
    visaPackageId: String(formData.get("visaPackageId") || ""),
    reason: String(formData.get("reason") || ""),
  });
}

export async function retireCatalogueEntryFromForm(
  _previous: CatalogueActionResult | null,
  formData: FormData,
): Promise<CatalogueActionResult> {
  return retireCatalogueEntry({
    visaPackageId: String(formData.get("visaPackageId") || ""),
    reason: String(formData.get("reason") || ""),
  });
}

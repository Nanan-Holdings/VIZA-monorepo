"use server";

import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key);
}

function textField(formData: FormData, key: string): string | undefined {
  const value = String(formData.get(key) || "").trim();
  return value || undefined;
}

function draftEvidence(formData: FormData): Stripe.DisputeUpdateParams.Evidence {
  return {
    customer_name: textField(formData, "customerName"),
    customer_email_address: textField(formData, "customerEmail"),
    product_description: textField(formData, "productDescription"),
    service_date: textField(formData, "serviceDate"),
    access_activity_log: textField(formData, "accessActivityLog"),
    refund_policy_disclosure: textField(formData, "refundPolicyDisclosure"),
    refund_refusal_explanation: textField(formData, "refundRefusalExplanation"),
    uncategorized_text: textField(formData, "additionalEvidence"),
  };
}

async function uploadEvidenceFile(stripe: Stripe, value: FormDataEntryValue | null): Promise<string | undefined> {
  if (!(value instanceof File) || value.size === 0) return undefined;
  if (value.size > 5 * 1024 * 1024) throw new Error(`${value.name} exceeds the 5 MB evidence limit`);
  const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);
  if (!allowed.has(value.type)) throw new Error(`${value.name} must be a PDF, JPEG, or PNG`);
  const uploaded = await stripe.files.create({
    purpose: "dispute_evidence",
    file: { data: Buffer.from(await value.arrayBuffer()), name: value.name, type: value.type },
  });
  return uploaded.id;
}

export async function syncAdminDispute(formData: FormData): Promise<void> {
  const refundRequestId = String(formData.get("refundRequestId") || "");
  const actor = await requireRole("admin", "staff");
  const admin = createAdminClient();
  const { data: refund } = await admin.from("refund_request").select("id, stripe_dispute_id, status").eq("id", refundRequestId).maybeSingle();
  if (!refund?.stripe_dispute_id) throw new Error("No Stripe dispute is linked to this request");
  const dispute = await stripeClient().disputes.retrieve(refund.stripe_dispute_id);
  const now = new Date().toISOString();
  const { data: before } = await admin.from("payment_dispute_cases").select("id, status, assigned_to").eq("refund_request_id", refundRequestId).maybeSingle();
  const row = {
    refund_request_id: refundRequestId,
    stripe_dispute_id: dispute.id,
    status: dispute.status,
    reason: dispute.reason,
    amount_cents: dispute.amount,
    currency: dispute.currency.toUpperCase(),
    evidence_due_at: dispute.evidence_details.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null,
    evidence: dispute.evidence,
    evidence_details: dispute.evidence_details,
    assigned_to: before?.assigned_to || actor.id,
    last_synced_at: now,
    updated_at: now,
  };
  const { error: auditError } = await admin.from("admin_command_events").insert({ actor_user_id: actor.id, command: "payment_dispute.sync", target_type: "refund_request", target_id: refundRequestId, reason: "Synchronized Stripe dispute state", before_state: before || {}, after_state: { status: row.status, evidence_due_at: row.evidence_due_at } });
  if (auditError) throw new Error(`Dispute sync stopped because audit failed: ${auditError.message}`);
  const { error } = await admin.from("payment_dispute_cases").upsert(row, { onConflict: "refund_request_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/refunds");
}

export async function handleAdminDisputeEvidence(formData: FormData): Promise<void> {
  const actor = await requireRole("admin");
  const refundRequestId = String(formData.get("refundRequestId") || "");
  const operation = formData.get("operation") === "submit" ? "submit" : "save";
  const reason = String(formData.get("staffReason") || "").trim();
  if (reason.length < 5) throw new Error("A staff reason is required");
  const evidence = draftEvidence(formData);
  if (!evidence.product_description) throw new Error("Product/service description is required");
  const admin = createAdminClient();
  const { data: disputeCase } = await admin.from("payment_dispute_cases").select("*").eq("refund_request_id", refundRequestId).maybeSingle();
  if (!disputeCase) throw new Error("Sync the Stripe dispute before preparing evidence");
  if (!["needs_response", "warning_needs_response"].includes(disputeCase.status) && operation === "submit") throw new Error(`Stripe dispute is ${disputeCase.status}; evidence cannot be submitted`);
  if (operation === "submit" && disputeCase.evidence_due_at && new Date(disputeCase.evidence_due_at) <= new Date()) throw new Error("The Stripe evidence deadline has passed");

  const fileNames = ["customerCommunication", "serviceDocumentation", "receipt", "refundPolicy"]
    .map((key) => formData.get(key))
    .filter((value): value is File => value instanceof File && value.size > 0)
    .map((file) => file.name);
  const { error: auditError } = await admin.from("admin_command_events").insert({
    actor_user_id: actor.id,
    command: operation === "submit" ? "payment_dispute.evidence_submit" : "payment_dispute.evidence_save",
    target_type: "refund_request",
    target_id: refundRequestId,
    reason,
    before_state: { status: disputeCase.status, evidence_details: disputeCase.evidence_details },
    after_state: { operation, evidence_fields: Object.keys(evidence).filter((key) => Boolean(evidence[key as keyof typeof evidence])), attachment_names: fileNames },
  });
  if (auditError) throw new Error(`Evidence command stopped because audit failed: ${auditError.message}`);

  if (operation === "save") {
    const { error } = await admin.from("payment_dispute_cases").update({ evidence, updated_at: new Date().toISOString() }).eq("id", disputeCase.id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/refunds");
    return;
  }

  const stripe = stripeClient();
  const [customerCommunication, serviceDocumentation, receipt, refundPolicy] = await Promise.all([
    uploadEvidenceFile(stripe, formData.get("customerCommunication")),
    uploadEvidenceFile(stripe, formData.get("serviceDocumentation")),
    uploadEvidenceFile(stripe, formData.get("receipt")),
    uploadEvidenceFile(stripe, formData.get("refundPolicy")),
  ]);
  const submittedEvidence: Stripe.DisputeUpdateParams.Evidence = {
    ...evidence,
    customer_communication: customerCommunication,
    service_documentation: serviceDocumentation,
    receipt,
    refund_policy: refundPolicy,
  };
  const dispute = await stripe.disputes.update(disputeCase.stripe_dispute_id, { evidence: submittedEvidence, submit: true });
  const now = new Date().toISOString();
  const { error } = await admin.from("payment_dispute_cases").update({ status: dispute.status, evidence: dispute.evidence, evidence_details: dispute.evidence_details, submitted_by: actor.id, submitted_at: now, last_synced_at: now, updated_at: now }).eq("id", disputeCase.id);
  if (error) throw new Error(`Evidence submitted to Stripe, but local state failed: ${error.message}`);
  revalidatePath("/admin/refunds");
  revalidatePath("/admin/work");
}

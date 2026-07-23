"use client";

import { createClient } from "@/lib/supabase/client";
import type { JapanAppointmentApiResponse, JapanAppointmentJob, JapanAppointmentSnapshot, JsonObject } from "@/types/japan-appointment";

const AGENT_BACKEND_URL = process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:3002";

export class JapanAppointmentApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = "JapanAppointmentApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data, error } = await createClient().auth.getSession();
  if (error || !data.session?.access_token) throw new JapanAppointmentApiError("session_required", "A signed-in session is required.", 401);
  const response = await fetch(`${AGENT_BACKEND_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}`, ...init.headers },
  });
  const payload = await response.json().catch(() => ({ error: true, code: "invalid_response", message: "Invalid Japan appointment response." })) as JapanAppointmentApiResponse<T>;
  if (!response.ok || payload.error || payload.data === undefined) {
    throw new JapanAppointmentApiError(payload.code ?? "japan_appointment_failed", payload.message ?? "Japan appointment request failed.", response.status);
  }
  return payload.data;
}

export function getJapanAppointmentStatus(applicationId: string) {
  return request<JapanAppointmentSnapshot>(`/api/applications/${applicationId}/japan-appointment/status`);
}

export function recordJapanAppointmentConsent(applicationId: string, consentSnapshot: JsonObject) {
  return request<{ consentRecorded: true }>(`/api/applications/${applicationId}/japan-appointment/consent`, {
    method: "POST", body: JSON.stringify({ accepted: true, consentSnapshot }),
  });
}

export function createJapanAppointmentJob(applicationId: string, eligibility: JsonObject) {
  return request<JapanAppointmentJob>(`/api/applications/${applicationId}/japan-appointment/job`, {
    method: "POST",
    body: JSON.stringify({ idempotencyKey: `japan-vfs-sg:${applicationId}`, automationMode: "public_recon", eligibility }),
  });
}

export function checkJapanAppointmentPortal(jobId: string) {
  return request<JapanAppointmentSnapshot>(`/api/japan-appointment/jobs/${jobId}/check-portal`, { method: "POST" });
}

export function cancelJapanAppointmentJob(jobId: string) {
  return request<JapanAppointmentSnapshot>(`/api/japan-appointment/jobs/${jobId}/cancel`, { method: "POST" });
}

export function selectJapanAppointmentSlot(jobId: string, slotId: string) {
  return request<JapanAppointmentSnapshot>(`/api/japan-appointment/jobs/${jobId}/slots/${slotId}/select`, { method: "POST" });
}

export function recordJapanAppointmentPayment(jobId: string, input: { card: { pan: string; expiry: string; cvv: string; holderName: string } }) {
  return request<JapanAppointmentSnapshot>(`/api/japan-appointment/jobs/${jobId}/payment-session`, { method: "POST", body: JSON.stringify(input) });
}

export function approveJapanAppointmentFinal(jobId: string) {
  return request<JapanAppointmentSnapshot>(`/api/japan-appointment/jobs/${jobId}/approve-final-confirmation`, { method: "POST" });
}

export function bookJapanAppointmentSlot(jobId: string) {
  return request<JapanAppointmentSnapshot>(`/api/japan-appointment/jobs/${jobId}/book-selected-slot`, { method: "POST" });
}

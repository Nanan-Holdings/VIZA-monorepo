"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  FranceAppointmentApiResponse,
  FranceAppointmentJob,
  FranceAppointmentMode,
  FranceAppointmentStatusSnapshot,
  JsonObject,
} from "@/types/france-appointment";

const AGENT_BACKEND_URL =
  process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:3002";

export class FranceAppointmentApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "FranceAppointmentApiError";
    this.code = code;
    this.status = status;
  }
}

async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new FranceAppointmentApiError(
      "session_required",
      "A signed-in session is required.",
      401,
    );
  }
  return data.session.access_token;
}

async function requestFranceAppointment<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${AGENT_BACKEND_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  const payload = (await response.json().catch(() => ({
    error: true,
    code: "invalid_response",
    message: "The France appointment service returned an invalid response.",
  }))) as FranceAppointmentApiResponse<T>;

  if (!response.ok || payload.error) {
    throw new FranceAppointmentApiError(
      payload.code ?? "france_appointment_request_failed",
      payload.message ?? "The France appointment request failed.",
      response.status,
    );
  }

  if (typeof payload.data === "undefined") {
    throw new FranceAppointmentApiError(
      "missing_response_data",
      "The France appointment service returned no data.",
      response.status,
    );
  }

  return payload.data;
}

export interface CreateFranceAppointmentJobPayload {
  mode?: FranceAppointmentMode;
  centerCode?: string;
  idempotencyKey?: string;
  userPreferencesJson?: JsonObject;
}

export function getFranceAppointmentStatus(
  applicationId: string,
): Promise<FranceAppointmentStatusSnapshot> {
  return requestFranceAppointment<FranceAppointmentStatusSnapshot>(
    `/api/applications/${applicationId}/france-appointment/status`,
  );
}

export function recordFranceAppointmentConsent(
  applicationId: string,
  payload: { consentSnapshot: JsonObject; idempotencyKey?: string },
): Promise<{ consentRecorded: true }> {
  return requestFranceAppointment<{ consentRecorded: true }>(
    `/api/applications/${applicationId}/france-appointment/consent`,
    {
      method: "POST",
      body: JSON.stringify({
        accepted: true,
        consentSnapshot: payload.consentSnapshot,
        idempotencyKey: payload.idempotencyKey,
      }),
    },
  );
}

export function createFranceAppointmentJob(
  applicationId: string,
  payload: CreateFranceAppointmentJobPayload,
): Promise<FranceAppointmentJob> {
  return requestFranceAppointment<FranceAppointmentJob>(
    `/api/applications/${applicationId}/france-appointment/job`,
    {
      method: "POST",
      body: JSON.stringify({
        mode: payload.mode ?? "dry_run",
        centerCode: payload.centerCode,
        userPreferencesJson: payload.userPreferencesJson,
        idempotencyKey: payload.idempotencyKey,
      }),
    },
  );
}

export function runFranceAppointmentJob(
  jobId: string,
): Promise<FranceAppointmentStatusSnapshot> {
  return requestFranceAppointment<FranceAppointmentStatusSnapshot>(
    `/api/france-appointment/jobs/${jobId}/run`,
    { method: "POST" },
  );
}

export function checkFranceAppointmentSlots(
  jobId: string,
): Promise<FranceAppointmentStatusSnapshot> {
  return requestFranceAppointment<FranceAppointmentStatusSnapshot>(
    `/api/france-appointment/jobs/${jobId}/check-slots`,
    { method: "POST" },
  );
}

export function selectFranceAppointmentSlot(
  jobId: string,
  slotId: string,
): Promise<FranceAppointmentStatusSnapshot> {
  return requestFranceAppointment<FranceAppointmentStatusSnapshot>(
    `/api/france-appointment/jobs/${jobId}/slots/${slotId}/select`,
    { method: "POST" },
  );
}

export function recordFrancePaymentSession(
  jobId: string,
  payload: {
    sessionId: string;
    redacted: {
      last4: string;
      expMonth: string;
      expYear: string;
      brand?: string;
      holderNamePresent?: boolean;
    };
  },
): Promise<FranceAppointmentStatusSnapshot> {
  return requestFranceAppointment<FranceAppointmentStatusSnapshot>(
    `/api/france-appointment/jobs/${jobId}/payment-session`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function approveFranceAppointmentFinalConfirmation(
  jobId: string,
): Promise<FranceAppointmentStatusSnapshot> {
  return requestFranceAppointment<FranceAppointmentStatusSnapshot>(
    `/api/france-appointment/jobs/${jobId}/approve-final-confirmation`,
    { method: "POST" },
  );
}

export function bookSelectedFranceAppointmentSlot(
  jobId: string,
): Promise<FranceAppointmentStatusSnapshot> {
  return requestFranceAppointment<FranceAppointmentStatusSnapshot>(
    `/api/france-appointment/jobs/${jobId}/book-selected-slot`,
    { method: "POST" },
  );
}

export function cancelFranceAppointmentJob(
  jobId: string,
): Promise<FranceAppointmentStatusSnapshot> {
  return requestFranceAppointment<FranceAppointmentStatusSnapshot>(
    `/api/france-appointment/jobs/${jobId}/cancel`,
    { method: "POST" },
  );
}

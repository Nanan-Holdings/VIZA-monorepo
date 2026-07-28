"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  AppointmentApiResponse,
  AppointmentAssistanceJob,
  RevealedAppointmentAccount,
  AppointmentStatusSnapshot,
  JsonObject,
  USAppointmentMode,
} from "@/types/us-appointment";

const AGENT_BACKEND_URL =
  process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:3002";

export class USAppointmentApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "USAppointmentApiError";
    this.code = code;
    this.status = status;
  }
}

async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new USAppointmentApiError(
      "session_required",
      "A signed-in session is required.",
      401,
    );
  }
  return data.session.access_token;
}

async function requestUSAppointment<T>(
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
    message: "The appointment service returned an invalid response.",
  }))) as AppointmentApiResponse<T>;

  if (!response.ok || payload.error) {
    throw new USAppointmentApiError(
      payload.code ?? "us_appointment_request_failed",
      payload.message ?? "The appointment request failed.",
      response.status,
    );
  }

  if (typeof payload.data === "undefined") {
    throw new USAppointmentApiError(
      "missing_response_data",
      "The appointment service returned no data.",
      response.status,
    );
  }

  return payload.data;
}

export interface CreateAppointmentJobPayload {
  mode?: USAppointmentMode;
  ds160ConfirmationCode?: string;
  applyingCountryCode: string;
  applyingPostCity?: string;
  schedulingProvider?: string;
  userPreferencesJson?: JsonObject;
  idempotencyKey?: string;
}

export function getAppointmentStatus(
  applicationId: string,
): Promise<AppointmentStatusSnapshot> {
  return requestUSAppointment<AppointmentStatusSnapshot>(
    `/api/applications/${applicationId}/us-appointment/status`,
  );
}

export function revealAppointmentAccount(
  applicationId: string,
): Promise<RevealedAppointmentAccount> {
  return requestUSAppointment<RevealedAppointmentAccount>(
    `/api/applications/${applicationId}/us-appointment/account`,
  );
}

export function recordAppointmentConsent(
  applicationId: string,
  payload: { consentSnapshot: JsonObject; idempotencyKey?: string },
): Promise<{ consentRecorded: true }> {
  return requestUSAppointment<{ consentRecorded: true }>(
    `/api/applications/${applicationId}/us-appointment/consent`,
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

export function createAppointmentJob(
  applicationId: string,
  payload: CreateAppointmentJobPayload,
): Promise<AppointmentAssistanceJob> {
  return requestUSAppointment<AppointmentAssistanceJob>(
    `/api/applications/${applicationId}/us-appointment/job`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function runAppointmentJob(
  jobId: string,
): Promise<AppointmentStatusSnapshot> {
  return requestUSAppointment<AppointmentStatusSnapshot>(
    `/api/us-appointment/jobs/${jobId}/run`,
    { method: "POST" },
  );
}

export function resumeAppointmentJob(
  jobId: string,
): Promise<AppointmentStatusSnapshot> {
  return requestUSAppointment<AppointmentStatusSnapshot>(
    `/api/us-appointment/jobs/${jobId}/resume`,
    { method: "POST" },
  );
}

export function completeAppointmentManualAction(
  actionId: string,
  userInput: JsonObject,
): Promise<AppointmentStatusSnapshot> {
  return requestUSAppointment<AppointmentStatusSnapshot>(
    `/api/us-appointment/manual-actions/${actionId}/complete`,
    {
      method: "POST",
      body: JSON.stringify({ userInput }),
    },
  );
}

export function selectAppointmentSlot(
  jobId: string,
  slotId: string,
): Promise<AppointmentStatusSnapshot> {
  return requestUSAppointment<AppointmentStatusSnapshot>(
    `/api/us-appointment/jobs/${jobId}/slots/${slotId}/select`,
    { method: "POST" },
  );
}

export function approveAppointmentFinalConfirmation(
  jobId: string,
): Promise<AppointmentStatusSnapshot> {
  return requestUSAppointment<AppointmentStatusSnapshot>(
    `/api/us-appointment/jobs/${jobId}/approve-final-confirmation`,
    { method: "POST" },
  );
}

export function bookSelectedAppointmentSlot(
  jobId: string,
): Promise<AppointmentStatusSnapshot> {
  return requestUSAppointment<AppointmentStatusSnapshot>(
    `/api/us-appointment/jobs/${jobId}/book-selected-slot`,
    { method: "POST" },
  );
}

export function checkAppointmentSlots(
  jobId: string,
): Promise<AppointmentStatusSnapshot> {
  return requestUSAppointment<AppointmentStatusSnapshot>(
    `/api/us-appointment/jobs/${jobId}/check-slots`,
    { method: "POST" },
  );
}

export function checkAppointmentStatus(
  jobId: string,
): Promise<AppointmentStatusSnapshot> {
  return requestUSAppointment<AppointmentStatusSnapshot>(
    `/api/us-appointment/jobs/${jobId}/check-status`,
    { method: "POST" },
  );
}

export function cancelAppointmentJob(
  jobId: string,
): Promise<AppointmentStatusSnapshot> {
  return requestUSAppointment<AppointmentStatusSnapshot>(
    `/api/us-appointment/jobs/${jobId}/cancel`,
    { method: "POST" },
  );
}

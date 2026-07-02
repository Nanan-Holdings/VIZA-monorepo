import { FRANCE_TLS_CHINA_CENTERS, resolveFranceTlsCenter } from "./center-registry";
import type { FranceTlsPaymentRedacted } from "./payment-session";

export type FranceTlsRunnerStatus =
  | "slots_observed"
  | "no_slots_available"
  | "payment_required"
  | "manual_required"
  | "confirmation_captured";

export interface FranceTlsRunnerSlot {
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation: string;
  appointmentType: string;
  source: string;
  metadataRedactedJson: Record<string, unknown>;
}

export interface FranceTlsRunnerResult {
  status: FranceTlsRunnerStatus;
  slots?: FranceTlsRunnerSlot[];
  confirmation?: {
    confirmationNumber: string;
    receiptUrl?: string | null;
    screenshotUrl?: string | null;
    paymentRedacted?: FranceTlsPaymentRedacted | null;
  };
  checkpoint?: {
    type: "captcha" | "login" | "payment" | "policy" | "selector_drift";
    message: string;
    metadataRedactedJson: Record<string, unknown>;
  };
}

export function buildFranceTlsDryRunSlots(centerCode: string): FranceTlsRunnerSlot[] {
  const center = resolveFranceTlsCenter(centerCode) ?? FRANCE_TLS_CHINA_CENTERS[0];
  return [
    {
      appointmentDate: "2026-09-15",
      appointmentTime: "09:00",
      appointmentLocation: `TLScontact ${center.cityEn}`,
      appointmentType: "France Schengen visa application submission",
      source: "france_tls_dry_run",
      metadataRedactedJson: {
        centerCode: center.code,
        provider: center.provider,
        bookingUrl: center.bookingUrl,
      },
    },
    {
      appointmentDate: "2026-09-16",
      appointmentTime: "14:30",
      appointmentLocation: `TLScontact ${center.cityEn}`,
      appointmentType: "France Schengen visa application submission",
      source: "france_tls_dry_run",
      metadataRedactedJson: {
        centerCode: center.code,
        provider: center.provider,
        bookingUrl: center.bookingUrl,
      },
    },
  ];
}

export class FranceTlsAppointmentProvider {
  readDryRunSlots(centerCode: string): FranceTlsRunnerResult {
    return {
      status: "slots_observed",
      slots: buildFranceTlsDryRunSlots(centerCode),
    };
  }

  captureDryRunConfirmation(input: {
    applicationId: string;
    centerCode: string;
    paymentRedacted?: FranceTlsPaymentRedacted | null;
  }): FranceTlsRunnerResult {
    const center = resolveFranceTlsCenter(input.centerCode) ?? FRANCE_TLS_CHINA_CENTERS[0];
    return {
      status: "confirmation_captured",
      confirmation: {
        confirmationNumber: `FR-TLS-DRYRUN-${input.applicationId.slice(0, 8).toUpperCase()}`,
        receiptUrl: null,
        screenshotUrl: null,
        paymentRedacted: input.paymentRedacted ?? null,
      },
      checkpoint: {
        type: "policy",
        message: "Dry-run only. No official TLScontact appointment was booked.",
        metadataRedactedJson: {
          centerCode: center.code,
          provider: center.provider,
        },
      },
    };
  }
}

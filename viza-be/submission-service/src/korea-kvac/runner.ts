export interface KoreaKvacRunInput {
  applicationId: string;
  jobId: string;
  selectedSlotId: string | null;
  centerCode: string;
  smsCodeProvided?: boolean;
  finalBookingApproved?: boolean;
}

export interface KoreaKvacSlot {
  id: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation: string;
  appointmentType: string;
  source: string;
}

export type KoreaKvacDryRunResult =
  | {
      status: "appointment_slots_observed";
      slots: KoreaKvacSlot[];
      message: string;
    }
  | {
      status: "appointment_booked";
      confirmationNumber: string;
      selectedSlotId: string;
      message: string;
    };

export interface KoreaKvacLiveGateResult {
  status: "manual_required";
  manualActionType:
    | "site_policy_review"
    | "appointment_slot_selection_required"
    | "sms_verification_required"
    | "final_booking_approval_required"
    | "official_confirmation_capture_required";
  message: string;
  expiresAt?: string;
  userInputSchema?: {
    type: "object";
    required: string[];
    properties: Record<string, unknown>;
  };
}

function dryRunSlots(centerCode: string): KoreaKvacSlot[] {
  const normalized = centerCode.trim().toLowerCase() || "beijing";
  return [
    {
      id: `dryrun-${normalized}-1`,
      appointmentDate: "2026-09-08",
      appointmentTime: "09:30",
      appointmentLocation: `KVAC ${normalized}`,
      appointmentType: "C-3-9 document intake",
      source: "dry_run",
    },
    {
      id: `dryrun-${normalized}-2`,
      appointmentDate: "2026-09-09",
      appointmentTime: "14:00",
      appointmentLocation: `KVAC ${normalized}`,
      appointmentType: "C-3-9 document intake",
      source: "dry_run",
    },
  ];
}

export async function runKoreaKvacDryRun(
  input: KoreaKvacRunInput,
): Promise<KoreaKvacDryRunResult> {
  const slots = dryRunSlots(input.centerCode);
  if (!input.selectedSlotId) {
    return {
      status: "appointment_slots_observed",
      slots,
      message: "Dry-run observed KVAC appointment slots. User selection is required before booking.",
    };
  }

  const selected = slots.find((slot) => slot.id === input.selectedSlotId);
  if (!selected) {
    throw new Error(`Selected Korea KVAC slot ${input.selectedSlotId} was not observed for this job.`);
  }

  return {
    status: "appointment_booked",
    selectedSlotId: selected.id,
    confirmationNumber: `KR-DRYRUN-${selected.id.replace(/^dryrun-/i, "").replace(/-/g, "-").toUpperCase()}`,
    message: "Dry-run booked the user-selected Korea KVAC appointment slot.",
  };
}

export async function runKoreaKvacLive(
  input: KoreaKvacRunInput,
): Promise<KoreaKvacLiveGateResult> {
  if (process.env.KR_KVAC_APPOINTMENT_ASSISTED_LIVE_ENABLED !== "true") {
    return {
      status: "manual_required",
      manualActionType: "site_policy_review",
      message:
        `Korea KVAC live booking is disabled for ${input.centerCode}. ` +
        "Enable KR_KVAC_APPOINTMENT_ASSISTED_LIVE_ENABLED only after per-center selectors, CAPTCHA handling, and SMS/real-name checkpoints are validated.",
    };
  }

  if (!input.selectedSlotId) {
    return {
      status: "manual_required",
      manualActionType: "appointment_slot_selection_required",
      message: "Korea KVAC live booking requires the applicant to choose an observed appointment slot before the worker books.",
    };
  }

  if (!input.smsCodeProvided) {
    return {
      status: "manual_required",
      manualActionType: "sms_verification_required",
      message:
        "Korea KVAC live booking must pause at the official SMS verification step. Ask the applicant to enter the SMS code within the portal timeout; do not log or persist the raw code.",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      userInputSchema: {
        type: "object",
        required: ["smsCode"],
        properties: {
          smsCode: { type: "string", minLength: 4, maxLength: 8, pattern: "^[0-9]+$" },
        },
      },
    };
  }

  if (!input.finalBookingApproved) {
    return {
      status: "manual_required",
      manualActionType: "final_booking_approval_required",
      message:
        "The SMS checkpoint is satisfied. Pause before the final official KVAC booking click and ask the applicant to approve the exact slot and center.",
      userInputSchema: {
        type: "object",
        required: ["approved"],
        properties: {
          approved: { type: "boolean", const: true },
        },
      },
    };
  }

  return {
    status: "manual_required",
    manualActionType: "official_confirmation_capture_required",
    message:
      "The applicant approved the final official booking click. Continue only in a validated per-center Playwright session and persist the official confirmation number plus screenshot/PDF before reporting success.",
  };
}

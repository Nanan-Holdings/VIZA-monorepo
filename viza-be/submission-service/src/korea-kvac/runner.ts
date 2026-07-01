export interface KoreaKvacRunInput {
  applicationId: string;
  jobId: string;
  selectedSlotId: string | null;
  centerCode: string;
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
  manualActionType: "site_policy_review";
  message: string;
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

  return {
    status: "manual_required",
    manualActionType: "site_policy_review",
    message:
      "Korea KVAC live booking gate is enabled, but per-center Playwright selectors are not promoted in this build. Preserve official evidence and complete selector validation before marking live success.",
  };
}

export interface KoreaAppointmentApplication {
  id: string;
  userId: string;
  visaType: string;
  country: string;
}

export interface KoreaAppointmentJob {
  id: string;
  applicationId: string;
  userId: string;
  status: string;
  selectedSlotId?: string | null;
}

export interface KoreaAppointmentSlot {
  id: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation: string;
  appointmentType: string;
  source?: string | null;
  status?: string;
}

export interface KoreaAppointmentConfirmation {
  id: string;
  jobId: string;
  confirmationNumber: string | null;
}

export interface KoreaAppointmentRepository {
  getApplication(applicationId: string): Promise<KoreaAppointmentApplication | null>;
  getLatestJob(applicationId: string): Promise<KoreaAppointmentJob | null>;
  createJob(input: {
    applicationId: string;
    userId: string;
    centerCode: string;
    routingInput: Record<string, unknown>;
  }): Promise<KoreaAppointmentJob>;
  insertSlots(jobId: string, slots: Omit<KoreaAppointmentSlot, "id">[]): Promise<KoreaAppointmentSlot[]>;
  selectSlot(jobId: string, slotId: string): Promise<KoreaAppointmentJob>;
  confirmBooking(jobId: string): Promise<KoreaAppointmentConfirmation>;
}

export interface KoreaAppointmentRoutingInput {
  currentResidenceProvince?: string | null;
  hasResidenceProof?: boolean | null;
  hukouProvince?: string | null;
  centerCode?: string | null;
}

function resolveCenterCode(input: KoreaAppointmentRoutingInput): string {
  if (input.centerCode?.trim()) return input.centerCode.trim();
  if (input.hasResidenceProof && input.currentResidenceProvince?.includes("上海")) return "shanghai";
  if (input.hukouProvince?.includes("湖北")) return "wuhan";
  return "beijing";
}

function dryRunSlots(centerCode: string): Omit<KoreaAppointmentSlot, "id">[] {
  return [
    {
      appointmentDate: "2026-09-08",
      appointmentTime: "09:30",
      appointmentLocation: `KVAC ${centerCode}`,
      appointmentType: "C-3-9 document intake",
      source: "dry_run",
      status: "observed",
    },
    {
      appointmentDate: "2026-09-09",
      appointmentTime: "14:00",
      appointmentLocation: `KVAC ${centerCode}`,
      appointmentType: "C-3-9 document intake",
      source: "dry_run",
      status: "observed",
    },
  ];
}

export class KoreaAppointmentService {
  constructor(private readonly repository: KoreaAppointmentRepository) {}

  async startSlotSearch(input: {
    applicationId: string;
    routingInput: KoreaAppointmentRoutingInput;
  }): Promise<{ job: KoreaAppointmentJob; slots: KoreaAppointmentSlot[] }> {
    const application = await this.repository.getApplication(input.applicationId);
    if (!application) throw new Error("Application not found.");
    if (application.visaType !== "KR_C39_SHORT_TERM_VISIT") {
      throw new Error("Korea appointment assistance only supports KR_C39_SHORT_TERM_VISIT.");
    }

    const centerCode = resolveCenterCode(input.routingInput);
    const existingJob = await this.repository.getLatestJob(input.applicationId);
    const job = existingJob ?? await this.repository.createJob({
      applicationId: application.id,
      userId: application.userId,
      centerCode,
      routingInput: input.routingInput as Record<string, unknown>,
    });
    const slots = await this.repository.insertSlots(job.id, dryRunSlots(centerCode));
    return { job, slots };
  }

  async selectSlot(applicationId: string, slotId: string): Promise<KoreaAppointmentJob> {
    const job = await this.repository.getLatestJob(applicationId);
    if (!job) throw new Error("Start a Korea appointment slot search before selecting a slot.");
    return this.repository.selectSlot(job.id, slotId);
  }

  async confirmBooking(applicationId: string): Promise<{ confirmation: KoreaAppointmentConfirmation }> {
    const job = await this.repository.getLatestJob(applicationId);
    if (!job) throw new Error("Start a Korea appointment slot search before booking.");
    if (!job.selectedSlotId) {
      throw new Error("Please select an appointment slot before confirming booking.");
    }
    const confirmation = await this.repository.confirmBooking(job.id);
    return { confirmation };
  }
}

export function createDryRunKoreaAppointmentService(
  repository: KoreaAppointmentRepository,
): KoreaAppointmentService {
  return new KoreaAppointmentService(repository);
}
